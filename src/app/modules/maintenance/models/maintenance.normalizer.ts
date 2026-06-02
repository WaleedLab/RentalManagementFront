import { Maintenance, MaintenanceSparePartLine } from './maintenance.model';

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

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function toOptionalLong(value: unknown): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = toNumber(value);
  return n !== undefined && n > 0 ? n : null;
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

function normalizeSparePartLines(value: unknown): MaintenanceSparePartLine[] {
  if (!Array.isArray(value)) return [];
  const out: MaintenanceSparePartLine[] = [];
  for (const item of value) {
    const r = (item ?? {}) as Record<string, unknown>;
    const idSparePartName =
      toNumber(
        pickLoose(
          r,
          'idSparePartName',
          'IdSparePartName',
          'sparePartId',
          'SparePartId',
          'id',
          'Id',
        ),
      ) ?? 0;
    const quantity =
      toNumber(pickLoose(r, 'quantity', 'Quantity', 'number', 'Number', 'qty', 'Qty')) ?? 0;
    if (idSparePartName <= 0 || quantity <= 0) continue;
    out.push({
      idSparePartName,
      quantity,
      sparePartName:
        String(pickLoose(r, 'sparePartName', 'SparePartName', 'name', 'Name') ?? '').trim() ||
        undefined,
    });
  }
  return out;
}

export function normalizeMaintenance(raw: unknown): Maintenance {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = toNumber(pickLoose(r, 'id', 'Id')) ?? 0;

  return {
    id: String(id),
    idBranch: toNumber(pickLoose(r, 'idBranch', 'IdBranch')) ?? 0,
    branchName: String(pickLoose(r, 'branchName', 'BranchName') ?? '').trim() || undefined,
    idVehicle: toNumber(pickLoose(r, 'idVehicle', 'IdVehicle')) ?? 0,
    plateNumber: String(pickLoose(r, 'plateNumber', 'PlateNumber') ?? '').trim() || undefined,
    idBooking: toOptionalLong(pickLoose(r, 'idBooking', 'IdBooking')),
    idInsurancecompanies: toOptionalLong(pickLoose(r, 'idInsurancecompanies', 'IdInsurancecompanies')),
    insuranceCompanyName:
      String(pickLoose(r, 'insuranceCompanyName', 'InsuranceCompanyName') ?? '').trim() || undefined,
    idSupplier: toOptionalLong(
      pickLoose(
        r,
        'idSupplier',
        'IdSupplier',
        'idSupplieres',
        'IdSupplieres',
        'idSuppliers',
        'IdSuppliers',
      ),
    ),
    supplierName:
      String(
        pickLoose(r, 'supplierName', 'SupplierName', 'suppliersName', 'SuppliersName') ?? '',
      ).trim() || undefined,
    startDate: String(pickLoose(r, 'startDate', 'StartDate') ?? ''),
    endDate: String(pickLoose(r, 'endDate', 'EndDate') ?? '').trim() || undefined,
    odometerIn: String(pickLoose(r, 'odometerIn', 'OdometerIn') ?? '').trim() || undefined,
    odometerOut: String(pickLoose(r, 'odometerOut', 'OdometerOut') ?? '').trim() || undefined,
    durationMaintenance:
      String(pickLoose(r, 'durationMaintenance', 'DurationMaintenance') ?? '').trim() || undefined,
    typeCompensation: String(pickLoose(r, 'typeCompensation', 'TypeCompensation') ?? '').trim() || undefined,
    note: String(pickLoose(r, 'note', 'Note') ?? '').trim() || undefined,
    valueCompensation: toNumber(pickLoose(r, 'valueCompensation', 'ValueCompensation')) ?? 0,
    status: toNumber(pickLoose(r, 'status', 'Status')) ?? 0,
    isAcceptable: toBool(pickLoose(r, 'isAcceptable', 'IsAcceptable')),
    fleetId: String(pickLoose(r, 'fleetId', 'FleetId') ?? '').trim() || undefined,
    url: String(pickLoose(r, 'url', 'Url') ?? '').trim() || undefined,
    total: toNumber(pickLoose(r, 'total', 'Total')) ?? null,
    createdBy: String(pickLoose(r, 'createdBy', 'CreatedBy') ?? '').trim() || undefined,
    spareParts: normalizeSparePartLines(
      pickLoose(
        r,
        'spareParts',
        'SpareParts',
        'maintenanceSpareParts',
        'MaintenanceSpareParts',
        'sparePartNames',
        'SparePartNames',
        'details',
        'Details',
      ),
    ),
  };
}
