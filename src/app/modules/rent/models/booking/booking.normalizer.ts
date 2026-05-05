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

/**
 * Resolves the first matching property ignoring key casing (handles mixed PascalCase / camelCase
 * from ASP.NET serializers and proxies where `key in source` can miss the actual key).
 */
function pickLoose(source: Record<string, unknown> | undefined, ...candidates: string[]): unknown {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  const keyByLower = new Map<string, string>();
  for (const k of Object.keys(source)) {
    keyByLower.set(k.toLowerCase(), k);
  }
  for (const wanted of candidates) {
    const actualKey = keyByLower.get(wanted.toLowerCase());
    if (actualKey !== undefined) {
      const value = source[actualKey];
      if (value !== undefined && value !== null) {
        return value;
      }
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
    trimText(
      pick(
        source,
        'customerNameAr',
        'CustomerNameAr',
        'customerName',
        'CustomerName',
        'nameAr',
        'NameAr',
        'fullName',
        'FullName',
      ),
    ) ?? trimText(customer ? pick(customer, 'nameAr', 'NameAr', 'fullName', 'FullName', 'nameEn', 'NameEn') : undefined);

  const customerNameEn =
    trimText(pick(source, 'customerNameEn', 'CustomerNameEn')) ??
    trimText(customer ? pick(customer, 'nameEn', 'NameEn') : undefined);

  const customerIqama =
    trimText(
      pick(
        source,
        'idNationality',
        'IdNationality',
        'identityNumber',
        'IdentityNumber',
        'customerNationalId',
        'CustomerNationalId',
      ),
    ) ??
    trimText(
      customer
        ? pick(
            customer,
            'idNationality',
            'IdNationality',
            'identityNumber',
            'IdentityNumber',
            'nationalId',
            'NationalId',
          )
        : undefined,
    );

  const customerNationality =
    trimText(pick(source, 'customerNationality', 'CustomerNationality', 'nationality', 'Nationality')) ??
    trimText(customer ? pick(customer, 'nationality', 'Nationality') : undefined);

  const customerMobile =
    trimText(
      pick(
        source,
        'firstMobileNumber',
        'FirstMobileNumber',
        'customerMobile',
        'CustomerMobile',
        'phoneNumber',
        'PhoneNumber',
      ),
    ) ??
    trimText(
      customer
        ? pick(
            customer,
            'firstMobileNumber',
            'FirstMobileNumber',
            'phoneNumber',
            'PhoneNumber',
            'mobile',
            'Mobile',
          )
        : undefined,
    );

  const customerAddress =
    trimText(pick(source, 'customerAddress', 'CustomerAddress', 'address', 'Address')) ??
    trimText(customer ? pick(customer, 'address', 'Address') : undefined);

  const customerDrivingLicenseNumber =
    trimText(
      pick(
        source,
        'customerDrivingLicenseNumber',
        'CustomerDrivingLicenseNumber',
        'licenceNo',
        'LicenceNo',
        'drivingLicenseNumber',
        'DrivingLicenseNumber',
      ),
    ) ??
    trimText(
      customer
        ? pick(
            customer,
            'licenceNo',
            'LicenceNo',
            'drivingLicenseNumber',
            'DrivingLicenseNumber',
          )
        : undefined,
    );

  const customerDrivingLicenseExpiry = toDateString(
    pickPresent(
      source,
      'customerDrivingLicenseExpiry',
      'CustomerDrivingLicenseExpiry',
      'dateDrivinglicense',
      'DateDrivinglicense',
      'dateDrivingLicense',
      'DateDrivingLicense',
    ) ??
      (customer
        ? pickPresent(
            customer,
            'dateDrivinglicense',
            'DateDrivinglicense',
            'dateDrivingLicense',
            'DateDrivingLicense',
            'drivingLicenseExpiryDate',
            'DrivingLicenseExpiryDate',
          )
        : undefined),
  );

  const customerBirthDay = toDateString(
    pickPresent(source, 'customerBirthDay', 'CustomerBirthDay', 'birthDay', 'BirthDay') ??
      (customer
        ? pickPresent(customer, 'birthDay', 'BirthDay', 'dateOfBirth', 'DateOfBirth')
        : undefined),
  );

  const vehiclePlate =
    trimText(
      pick(
        source,
        'vehiclePlatnumber',
        'VehiclePlatnumber',
        'plateNumber',
        'PlateNumber',
        'vehiclePlateNumber',
        'VehiclePlateNumber',
      ),
    ) ?? trimText(vehicle ? pick(vehicle, 'plateNumber', 'PlateNumber') : undefined);

  const vehicleSerialNumber =
    trimText(pick(source, 'vehicleSerialNumber', 'VehicleSerialNumber', 'serialNumber', 'SerialNumber')) ??
    trimText(vehicle ? pick(vehicle, 'serialNumber', 'SerialNumber') : undefined);

  const vehicleYear =
    toNumber(
      pickLoose(
        source,
        'vehicleYear',
        'VehicleYear',
        'year',
        'Year',
        'modelYear',
        'ModelYear',
        'manufactureYear',
        'ManufactureYear',
        'vehicleModelYear',
        'VehicleModelYear',
      ),
    ) ??
    toNumber(pick(source, 'vehicleYear', 'VehicleYear')) ??
    toNumber(vehicle ? pick(vehicle, 'year', 'Year', 'yearMake', 'YearMake', 'vehicleYear', 'VehicleYear') : undefined);

  const vehicleColor =
    trimText(
      pickLoose(source, 'vehicleColor', 'color', 'colour', 'colorName', 'vehicleColorName', 'vehicleColour'),
    ) ??
    trimText(pick(source, 'vehicleColor', 'VehicleColor', 'color', 'Color')) ??
    trimText(
      vehicle
        ? pickLoose(vehicle, 'vehicleColor', 'color', 'colour', 'colorName', 'vehicleColour')
        : undefined,
    ) ??
    trimText(vehicle ? pick(vehicle, 'color', 'Color', 'vehicleColor', 'VehicleColor') : undefined);

  const vehicleEngine =
    trimText(pick(source, 'vehicleEngine', 'VehicleEngine', 'engine', 'Engine')) ??
    trimText(vehicle ? pick(vehicle, 'engine', 'Engine') : undefined);

  const vehicleCategoryLabel =
    trimText(
      pick(
        source,
        'categoryVehicleName',
        'CategoryVehicleName',
        'vehicleCategoryLabel',
        'VehicleCategoryLabel',
        'vehicleCategoryName',
        'VehicleCategoryName',
        'categoryName',
        'CategoryName',
      ),
    ) ?? trimText(vehicle ? pick(vehicle, 'categoryName', 'CategoryName') : undefined);

  const vehicleImageUrl =
    trimText(
      pick(source, 'url', 'Url', 'vehicleImageUrl', 'VehicleImageUrl', 'imageUrl', 'ImageUrl'),
    ) ??
    trimText(vehicle ? pick(vehicle, 'url', 'Url', 'imageUrl', 'ImageUrl') : undefined);

  const vehicleName =
    trimText(pick(source, 'vehicleDisplayName', 'VehicleDisplayName', 'vehicleName', 'VehicleName')) ??
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

  const branchStreet = trimText(pick(source, 'branchStreet', 'BranchStreet'));
  const branchNeighborHood = trimText(pick(source, 'branchNeighborHood', 'BranchNeighborHood'));
  const branchBuildingNumber = trimText(pick(source, 'branchBuldingNumber', 'BranchBuldingNumber', 'branchBuildingNumber', 'BranchBuildingNumber'));
  const branchCity = trimText(pick(source, 'branchCity', 'BranchCity'));

  const statusDisplayName = trimText(
    pick(source, 'statusDisplayName', 'StatusDisplayName'),
  );

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
    trimText(pickLoose(source, 'fleetName', 'FleetName')) ??
    trimText(pick(source, 'fleetName', 'FleetName')) ??
    trimText(fleet ? pick(fleet, 'name', 'Name', 'nameAr', 'NameAr') : undefined);

  const createdBy = trimText(pick(source, 'createdBy', 'CreatedBy'));
  const updatedBy = trimText(pick(source, 'updatedBy', 'UpdatedBy'));
  const deletedBy = trimText(pick(source, 'deletedBy', 'DeletedBy'));
  const createdAt = toDateString(pickPresent(source, 'createdAt', 'CreatedAt'));
  const updatedAt = toDateString(pickPresent(source, 'updatedAt', 'UpdatedAt'));
  const deletedAt = toDateString(pickPresent(source, 'deletedAt', 'DeletedAt'));

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
    bookingNumber: trimText(pick(source, 'bookingNumber', 'BookingNumber')) ?? undefined,
    paymentNumber: trimText(pick(source, 'paymentNumber', 'PaymentNumber')) ?? undefined,
    numberBookingINBasame:
      trimText(pick(source, 'numberBookingINBasame', 'NumberBookingINBasame')) ?? undefined,
    fleetId: String(pick(source, 'fleetId', 'FleetId') ?? ''),
    fleetName,
    urlLogo: trimText(pickLoose(source, 'urllogo', 'urlLogo', 'Urllogo', 'UrlLogo')) ?? undefined,
    taxNumber: trimText(pick(source, 'taxNumber', 'TaxNumber')) ?? undefined,
    branchId: pick<number>(source, 'branchId', 'BranchId', 'idBranch', 'IdBranch') ?? null,
    branchName,
    branchStreet: branchStreet || undefined,
    branchNeighborHood: branchNeighborHood || undefined,
    branchBuildingNumber: branchBuildingNumber || undefined,
    branchCity: branchCity || undefined,
    customerId,
    customerName,
    customerNameEn: customerNameEn || undefined,
    customerIqama,
    customerNationality: customerNationality || undefined,
    customerMobile: customerMobile || undefined,
    customerAddress: customerAddress || undefined,
    customerDrivingLicenseNumber: customerDrivingLicenseNumber || undefined,
    customerDrivingLicenseExpiry: customerDrivingLicenseExpiry || undefined,
    customerBirthDay: customerBirthDay || undefined,
    vehicleId,
    vehicleImageUrl: vehicleImageUrl || undefined,
    vehicleName,
    vehiclePlateNumber: vehiclePlate,
    vehicleSerialNumber,
    vehicleYear,
    vehicleColor: vehicleColor || undefined,
    vehicleEngine: vehicleEngine || undefined,
    vehicleCategoryLabel: vehicleCategoryLabel || undefined,
    startDate,
    endDate,
    pickupDate: pickupDate || undefined,
    returnDate: returnDate || undefined,
    totalAmount: toNumber(
      pickLoose(source, 'TOTAL', 'total', 'totalAmount', 'paidtotal', 'Paidtotal') ??
        pick(
          source,
          'TOTAL',
          'total',
          'Total',
          'totalAmount',
          'TotalAmount',
          'paidtotal',
          'Paidtotal',
          'paid',
          'Paid',
        ),
    ),
    paidtotal: toNumber(pick(source, 'paidtotal', 'Paidtotal', 'paidTotal', 'PaidTotal')),
    depositAmount: toNumber(pick(source, 'depositAmount', 'DepositAmount')),
    paidAmount: toNumber(pick(source, 'paidAmount', 'PaidAmount', 'paid', 'Paid', 'paidCash', 'PaidCash')),
    status: normalizeBookingStatus(statusRaw),
    statusDisplayName,
    notes,
    createdBy,
    updatedBy,
    deletedBy,
    createdAt: createdAt || undefined,
    updatedAt: updatedAt || undefined,
    deletedAt: deletedAt || undefined,
    distancetraveledgps: trimText(pick(source, 'distancetraveledgps', 'Distancetraveledgps')),
    numberOfHoursExcess: toNumber(pick(source, 'numberOfHoursExcess', 'NumberOfHoursExcess')),
    numberKmExcess: toNumber(pick(source, 'numberKmExcess', 'NumberKmExcess')),
    dayExcess: toNumber(pick(source, 'dayExcess', 'DayExcess')),
    discount: toNumber(pick(source, 'discount', 'Discount')),
    checkoutCounter: toNumber(pick(source, 'checkoutCounter', 'CheckoutCounter')),
    checkinCounter: toNumber(pick(source, 'checkinCounter', 'CheckinCounter')),
    checkoutPhotoFrontUrl: trimText(
      pickLoose(
        source,
        'checkoutPhotoFrontUrl',
        'CheckoutPhotoFrontUrl',
        'checkoutFrontPhotoUrl',
        'CheckoutFrontPhotoUrl',
        'urlCheckoutFront',
        'UrlCheckoutFront',
      ),
    ),
    checkoutPhotoRightUrl: trimText(
      pickLoose(
        source,
        'checkoutPhotoRightUrl',
        'CheckoutPhotoRightUrl',
        'checkoutRightPhotoUrl',
        'CheckoutRightPhotoUrl',
        'urlCheckoutRight',
        'UrlCheckoutRight',
      ),
    ),
    checkoutPhotoLeftUrl: trimText(
      pickLoose(
        source,
        'checkoutPhotoLeftUrl',
        'CheckoutPhotoLeftUrl',
        'checkoutLeftPhotoUrl',
        'CheckoutLeftPhotoUrl',
        'urlCheckoutLeft',
        'UrlCheckoutLeft',
      ),
    ),
    checkoutPhotoBackUrl: trimText(
      pickLoose(
        source,
        'checkoutPhotoBackUrl',
        'CheckoutPhotoBackUrl',
        'checkoutBackPhotoUrl',
        'CheckoutBackPhotoUrl',
        'urlCheckoutBack',
        'UrlCheckoutBack',
      ),
    ),
    checkoutPhotoInteriorUrl: trimText(
      pickLoose(
        source,
        'checkoutPhotoInteriorUrl',
        'CheckoutPhotoInteriorUrl',
        'checkoutInteriorPhotoUrl',
        'CheckoutInteriorPhotoUrl',
        'urlCheckoutInterior',
        'UrlCheckoutInterior',
      ),
    ),
    checkinPhotoFrontUrl: trimText(
      pickLoose(
        source,
        'checkinPhotoFrontUrl',
        'CheckinPhotoFrontUrl',
        'checkinFrontPhotoUrl',
        'CheckinFrontPhotoUrl',
        'urlCheckinFront',
        'UrlCheckinFront',
        'returnPhotoFrontUrl',
        'ReturnPhotoFrontUrl',
      ),
    ),
    checkinPhotoRightUrl: trimText(
      pickLoose(
        source,
        'checkinPhotoRightUrl',
        'CheckinPhotoRightUrl',
        'checkinRightPhotoUrl',
        'CheckinRightPhotoUrl',
        'urlCheckinRight',
        'UrlCheckinRight',
        'returnPhotoRightUrl',
        'ReturnPhotoRightUrl',
      ),
    ),
    checkinPhotoLeftUrl: trimText(
      pickLoose(
        source,
        'checkinPhotoLeftUrl',
        'CheckinPhotoLeftUrl',
        'checkinLeftPhotoUrl',
        'CheckinLeftPhotoUrl',
        'urlCheckinLeft',
        'UrlCheckinLeft',
        'returnPhotoLeftUrl',
        'ReturnPhotoLeftUrl',
      ),
    ),
    checkinPhotoBackUrl: trimText(
      pickLoose(
        source,
        'checkinPhotoBackUrl',
        'CheckinPhotoBackUrl',
        'checkinBackPhotoUrl',
        'CheckinBackPhotoUrl',
        'urlCheckinBack',
        'UrlCheckinBack',
        'returnPhotoBackUrl',
        'ReturnPhotoBackUrl',
      ),
    ),
    checkinPhotoInteriorUrl: trimText(
      pickLoose(
        source,
        'checkinPhotoInteriorUrl',
        'CheckinPhotoInteriorUrl',
        'checkinInteriorPhotoUrl',
        'CheckinInteriorPhotoUrl',
        'urlCheckinInterior',
        'UrlCheckinInterior',
        'returnPhotoInteriorUrl',
        'ReturnPhotoInteriorUrl',
      ),
    ),
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
    idCountingCustVehicle: trimText(
      pickLoose(source, 'idCountingCustVehicle', 'IdCountingCustVehicle') ??
        pick(source, 'idCountingCustVehicle', 'IdCountingCustVehicle'),
    ),
    countingCustVehicleName:
      trimText(pickLoose(source, 'countingCustVehicleName', 'CountingCustVehicleName')) ??
      trimText(pick(source, 'countingCustVehicleName', 'CountingCustVehicleName')) ??
      undefined,
  };
}
