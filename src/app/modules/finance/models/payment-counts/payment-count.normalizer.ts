import { PaymentCount } from './payment-count.model';
import { pick } from '../shared/finance-normalizer.utils';

function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function normalizePaymentCount(raw: unknown): PaymentCount {
  const source = (raw ?? {}) as Record<string, unknown>;
  const vehicleSource = asRecord(pick(source, 'vehicle', 'Vehicle'));
  const vehicleCategorySource = asRecord(
    vehicleSource ? pick(vehicleSource, 'categoryVehicle', 'CategoryVehicle') : null,
  );
  const paymentNumber = toNumberOrUndefined(
    pick(
      source,
      'paymentNumber',
      'PaymentNumber',
      'paymentnumber',
      'Paymentnumber',
      'voucherNumber',
      'VoucherNumber',
      'paymentNo',
      'PaymentNo',
      'paymentCountNumber',
      'PaymentCountNumber',
      'number',
      'Number',
    ),
  );
  const rawVehicleId = pick<unknown>(
    source,
    'idVehicle',
    'IdVehicle',
    'vehicleId',
    'VehicleId',
  );
  const normalizedVehicleId =
    rawVehicleId === null || rawVehicleId === undefined || rawVehicleId === ''
      ? undefined
      : typeof rawVehicleId === 'number'
        ? rawVehicleId
        : String(rawVehicleId).trim();
  const detailsRaw = pick<unknown>(source, 'details', 'Details');
  const normalizedDetails = Array.isArray(detailsRaw)
    ? detailsRaw.filter(detail => detail && typeof detail === 'object') as Array<Record<string, unknown>>
    : [];

  return {
    id: String(
      pick(
        source,
        'paymentcountId',
        'PaymentcountId',
        'paymentCountId',
        'PaymentCountId',
        'idPaymentcount',
        'IdPaymentcount',
        'voucherId',
        'VoucherId',
        'id',
        'Id',
      ) ?? '',
    ),
    paymentNumber,
    name: pick<string>(source, 'name', 'Name', 'title', 'Title'),
    description: pick<string>(source, 'description', 'Description', 'dscription', 'Dscription', 'note', 'Note'),
    idCustomer: pick<number>(source, 'idCustomer', 'IdCustomer'),
    customerName: pick<string>(source, 'customerName', 'CustomerName'),
    taxNumber: pick<string>(source, 'taxNumber', 'TaxNumber'),
    urllogo: pick<string>(source, 'urllogo', 'Urllogo', 'urlLogo', 'UrlLogo'),
    idVehicle: normalizedVehicleId,
    vehicleName: pick<string>(
      source,
      'vehicleName',
      'VehicleName',
      'nameVehicle',
      'NameVehicle',
      'carName',
      'CarName',
    ) ?? pick<string>(vehicleSource ?? {}, 'name', 'Name', 'vehicleName', 'VehicleName'),
    plateNumber: pick<string>(
      source,
      'plateNumber',
      'PlateNumber',
      'vehiclePlatnumber',
      'VehiclePlatnumber',
      'vehiclePlatNumber',
      'VehiclePlatNumber',
    ) ?? pick<string>(vehicleSource ?? {}, 'plateNumber', 'PlateNumber', 'vehiclePlatnumber', 'VehiclePlatnumber'),
    yearMake: pick<string | number>(source, 'yearMake', 'YearMake', 'vehicleYear', 'VehicleYear'),
    vehicleCategory:
      pick<string>(
        source,
        'vehicleCategory',
        'VehicleCategory',
        'categoryName',
        'CategoryName',
        'vehicleCategoryName',
        'VehicleCategoryName',
      ) ??
      pick<string>(vehicleSource ?? {}, 'categoryName', 'CategoryName', 'vehicleCategoryName', 'VehicleCategoryName') ??
      pick<string>(vehicleCategorySource ?? {}, 'nameAr', 'NameAr', 'nameEn', 'NameEn', 'name', 'Name'),
    idBranch: pick<number>(source, 'idBranch', 'IdBranch'),
    branchName: pick<string>(source, 'branchName', 'BranchName'),
    paid: pick<number>(source, 'paid', 'Paid'),
    paymentType: pick<number>(source, 'paymentType', 'PaymentType'),
    bondType: pick<number>(source, 'bondType', 'BondType'),
    status: pick<number>(source, 'status', 'Status'),
    idCash: pick<string>(source, 'idCash', 'IdCash'),
    idBank: pick<string>(source, 'idBank', 'IdBank'),
    paidCash: pick<number>(source, 'paidCash', 'PaidCash'),
    paidBank: pick<number>(source, 'paidBank', 'PaidBank'),
    expenseCategory: pick<number>(source, 'expenseCategory', 'ExpenseCategory'),
    idBooking: pick<number>(source, 'idBooking', 'IdBooking'),
    idFinancialYear: pick<string | number>(source, 'idFinancialYear', 'IdFinancialYear'),
    details: normalizedDetails,
    createdAt: pick<string>(
      source,
      'createdAt',
      'CreatedAt',
      'creationDate',
      'CreationDate',
      'createdOn',
      'CreatedOn'
    ),
  };
}

