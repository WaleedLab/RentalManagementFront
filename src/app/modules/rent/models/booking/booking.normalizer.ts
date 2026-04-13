import { Booking } from './booking.model';
import { bookingStatusFromCode } from './booking-status.utils';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

/** Value may be null (e.g. SQL NULL serialized as JSON null). */
function pickPresent<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source) {
      return source[key] as T;
    }
  }
  return undefined;
}

function toDateString(value: unknown): string {
  if (value === undefined || value === null) {
    return '';
  }
  return String(value).trim();
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toBool(value: unknown): boolean | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (value === 1) {
      return true;
    }
    if (value === 0) {
      return false;
    }
  }
  const s = String(value).trim().toLowerCase();
  if (['true', '1', 'yes'].includes(s)) {
    return true;
  }
  if (['false', '0', 'no'].includes(s)) {
    return false;
  }
  return undefined;
}

function normalizeBookingStatus(raw: unknown): Booking['status'] {
  return bookingStatusFromCode(raw);
}

function trimText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const s = String(value).trim();
  return s ? s : undefined;
}

export function normalizeBooking(raw: unknown): Booking {
  const source = (raw ?? {}) as Record<string, unknown>;

  const customer = asRecord(pick(source, 'customer', 'Customer'));
  const vehicle = asRecord(pick(source, 'vehicle', 'Vehicle'));
  const fleet = asRecord(pick(source, 'fleet', 'Fleet'));

  /** `BookingDto.Id` (long); fallbacks for other booking list DTOs. */
  const id =
    trimText(pick(source, 'id', 'Id', 'idBooking', 'IdBooking', 'bookingId', 'BookingId')) ?? '';

  const customerId =
    trimText(
      pick(
        source,
        'customerId',
        'CustomerId',
        'idCustomer',
        'IdCustomer',
        'idCustomar',
        'IdCustomar',
      ) ?? (customer ? pick(customer, 'id', 'Id') : undefined),
    ) ?? '';

  const vehicleId =
    trimText(
      pick(source, 'vehicleId', 'VehicleId', 'idVehicle', 'IdVehicle') ??
        (vehicle ? pick(vehicle, 'id', 'Id') : undefined),
    ) ?? '';

  const customerName =
    trimText(pick(source, 'customerName', 'CustomerName', 'nameAr', 'NameAr', 'fullName', 'FullName')) ??
    trimText(customer ? pick(customer, 'nameAr', 'NameAr', 'fullName', 'FullName', 'nameEn', 'NameEn') : undefined);

  const vehiclePlate =
    trimText(pick(source, 'plateNumber', 'PlateNumber', 'vehiclePlateNumber', 'VehiclePlateNumber')) ??
    trimText(vehicle ? pick(vehicle, 'plateNumber', 'PlateNumber') : undefined);

  const vehicleName =
    trimText(pick(source, 'vehicleName', 'VehicleName')) ??
    trimText(
      vehicle
        ? [
            pick<string>(vehicle, 'make', 'Make'),
            pick<string>(vehicle, 'model', 'Model'),
            pick<string>(vehicle, 'plateNumber', 'PlateNumber'),
          ]
            .filter(Boolean)
            .join(' ')
        : undefined,
    ) ??
    vehiclePlate;

  const branchName =
    trimText(
      pick(source, 'branchName', 'BranchName', 'branchNameAr', 'BranchNameAr'),
    ) ??
    trimText(pick(source, 'placeUSE', 'PlaceUSE', 'placeUse', 'PlaceUse'));

  const startDate = toDateString(
    pickPresent(source, 'startDate', 'StartDate', 'dateFrom', 'DateFrom', 'rentStartDate', 'RentStartDate'),
  );
  const endDate = toDateString(
    pickPresent(source, 'endDate', 'EndDate', 'dateTo', 'DateTo', 'rentEndDate', 'RentEndDate'),
  );

  const pickupDate = toDateString(
    pickPresent(source, 'pickupDate', 'PickupDate', 'datePickup', 'DatePickup'),
  );
  const returnDate = toDateString(
    pickPresent(
      source,
      'returnDate',
      'ReturnDate',
      'dateReturnVehical',
      'DateReturnVehical',
      'dateReturnVehicle',
      'DateReturnVehicle',
    ),
  );

  /** `BookingDto.Stutus` (string); list DTOs use `Stutusbooking` (int). */
  const statusRaw =
    pick(
      source,
      'stutus',
      'Stutus',
      'stutusbooking',
      'Stutusbooking',
      'stutusBooking',
      'StutusBooking',
      'status',
      'Status',
      'bookingStatus',
      'BookingStatus',
    ) ?? pick(source, 'state', 'State');

  const notes =
    trimText(
      pick(source, 'notes', 'Notes', 'note', 'Note', 'dscription', 'Dscription', 'description', 'Description'),
    ) ?? undefined;

  const fleetName =
    trimText(pick(source, 'fleetName', 'FleetName')) ??
    trimText(fleet ? pick(fleet, 'name', 'Name', 'nameAr', 'NameAr') : undefined);

  const createdBy = trimText(pick(source, 'createdBy', 'CreatedBy'));
  const createdAt = toDateString(pickPresent(source, 'createdAt', 'CreatedAt'));
  const updatedAt = toDateString(pickPresent(source, 'updatedAt', 'UpdatedAt'));

  const taxRaw = pickPresent(source, 'totaltax', 'Totaltax');
  let totaltax: number | null | undefined;
  if (taxRaw === undefined) {
    totaltax = undefined;
  } else if (taxRaw === null) {
    totaltax = null;
  } else {
    totaltax = toNumber(taxRaw);
  }

  return {
    id,
    bookingNumber:
      trimText(
        pick(source, 'bookingNumber', 'BookingNumber', 'numberBookingINBasame', 'NumberBookingINBasame'),
      ) ?? undefined,
    fleetId: String(pick(source, 'fleetId', 'FleetId') ?? ''),
    fleetName,
    branchId: pick<number>(source, 'branchId', 'BranchId', 'idBranch', 'IdBranch') ?? null,
    branchName,
    customerId,
    customerName,
    vehicleId,
    vehicleName,
    vehiclePlateNumber: vehiclePlate,
    startDate,
    endDate,
    pickupDate: pickupDate || undefined,
    returnDate: returnDate || undefined,
    totalAmount: toNumber(
      pick(source, 'TOTAL', 'total', 'Total', 'totalAmount', 'TotalAmount', 'paidtotal', 'Paidtotal', 'paid', 'Paid'),
    ),
    paidtotal: toNumber(pick(source, 'paidtotal', 'Paidtotal', 'paidTotal', 'PaidTotal')),
    depositAmount: toNumber(pick(source, 'depositAmount', 'DepositAmount')),
    paidAmount: toNumber(pick(source, 'paidAmount', 'PaidAmount', 'paid', 'Paid', 'paidCash', 'PaidCash')),
    status: normalizeBookingStatus(statusRaw),
    notes,
    createdBy,
    createdAt: createdAt || undefined,
    updatedAt: updatedAt || undefined,
    distancetraveledgps: trimText(pick(source, 'distancetraveledgps', 'Distancetraveledgps')),
    numberOfHoursExcess: toNumber(pick(source, 'numberOfHoursExcess', 'NumberOfHoursExcess')),
    numberKmExcess: toNumber(pick(source, 'numberKmExcess', 'NumberKmExcess')),
    dayExcess: toNumber(pick(source, 'dayExcess', 'DayExcess')),
    discount: toNumber(pick(source, 'discount', 'Discount')),
    checkoutCounter: toNumber(pick(source, 'checkoutCounter', 'CheckoutCounter')),
    checkinCounter: toNumber(pick(source, 'checkinCounter', 'CheckinCounter')),
    countOfDay: toNumber(pick(source, 'countOfDay', 'CountOfDay')),
    isDeleted:
      toBool(pick(source, 'isDeleted', 'IsDeleted')) ?? toBool(pick(source, 'isDelete', 'IsDelete')),
    isprview: toBool(pick(source, 'isprview', 'Isprview')),
    priceInDay: toNumber(pick(source, 'priceInDay', 'PriceInDay')),
    priceInMonth: toNumber(pick(source, 'priceInMonth', 'PriceInMonth')),
    allowTo: toNumber(pick(source, 'allowTo', 'AllowTo')),
    countKMExtra: toNumber(pick(source, 'countKMExtra', 'CountKMExtra')),
    priceHoureExtra: toNumber(pick(source, 'priceHoureExtra', 'PriceHoureExtra')),
    priceKmExtra: toNumber(pick(source, 'priceKmExtra', 'PriceKmExtra')),
    otherExpenses: toNumber(pick(source, 'otherExpenses', 'OtherExpenses')),
    totalTrafic: toNumber(pick(source, 'totalTrafic', 'TotalTrafic')),
    totalMaintance: toNumber(pick(source, 'totalMaintance', 'TotalMaintance')),
    totalReceivedVehicle: toNumber(pick(source, 'totalReceivedVehicle', 'TotalReceivedVehicle')),
    transportationFees: toNumber(pick(source, 'transportationFees', 'TransportationFees')),
    totaltax,
    placeUSE: trimText(pick(source, 'placeUSE', 'PlaceUSE', 'placeUse', 'PlaceUse')),
  };
}
