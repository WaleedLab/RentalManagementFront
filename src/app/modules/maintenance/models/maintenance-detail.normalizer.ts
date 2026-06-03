import { MaintenanceDetail } from './maintenance-detail.model';

function pickLoose(source: Record<string, unknown> | undefined, ...candidates: string[]): unknown {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  const keyByLower = new Map<string, string>();
  for (const k of Object.keys(source)) {
    keyByLower.set(k.toLowerCase(), k);
  }
  for (const wanted of candidates) {
    const actual = keyByLower.get(wanted.toLowerCase());
    if (!actual) {
      continue;
    }
    const value = source[actual];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function toNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBool(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    return value !== 0;
  }
  const s = String(value ?? '').trim().toLowerCase();
  return s === 'true' || s === '1' || s === 'yes';
}

export function normalizeMaintenanceDetail(raw: unknown): MaintenanceDetail {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pickLoose(source, 'id', 'Id') ?? ''),
    idMaintenance: toNumber(pickLoose(source, 'idMaintenance', 'IdMaintenance')),
    idSparePartName: toNumber(pickLoose(source, 'idSparePartName', 'IdSparePartName')),
    sparePartName:
      String(pickLoose(source, 'sparePartName', 'SparePartName') ?? '').trim() || undefined,
    idSupplier: toNumber(pickLoose(source, 'idSupplier', 'IdSupplier')),
    supplierName: String(pickLoose(source, 'supplierName', 'SupplierName') ?? '').trim() || undefined,
    price: toNumber(pickLoose(source, 'price', 'Price')),
    tax: toNumber(pickLoose(source, 'tax', 'Tax')),
    numberInvoice: toNumber(pickLoose(source, 'numberInvoice', 'NumberInvoice')),
    dateInvoice: String(pickLoose(source, 'dateInvoice', 'DateInvoice') ?? ''),
    typeMaintenance: toNumber(pickLoose(source, 'typeMaintenance', 'TypeMaintenance')),
    isAcceptable: toBool(pickLoose(source, 'isAcceptable', 'IsAcceptable')),
    fleetId: String(pickLoose(source, 'fleetId', 'FleetId') ?? '').trim() || undefined,
    createdAt: String(pickLoose(source, 'createdAt', 'CreatedAt') ?? '').trim() || undefined,
  };
}
