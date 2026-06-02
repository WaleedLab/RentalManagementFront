import { Supplier } from './supplier.model';

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
    if (!actual) continue;
    const value = source[actual];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

export function normalizeSupplier(raw: unknown): Supplier {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pickLoose(source, 'id', 'Id') ?? ''),
    fleetId: String(pickLoose(source, 'fleetId', 'FleetId') ?? ''),
    supplierName: String(pickLoose(source, 'supplierName', 'SupplierName') ?? '').trim(),
    phone: String(pickLoose(source, 'phone', 'Phone') ?? '').trim(),
    phone2: String(pickLoose(source, 'phone2', 'Phone2') ?? '').trim() || undefined,
    address: String(pickLoose(source, 'address', 'Address') ?? '').trim() || undefined,
    email: String(pickLoose(source, 'email', 'Email') ?? '').trim() || undefined,
    taxRecord: String(pickLoose(source, 'taxRecord', 'TaxRecord') ?? '').trim() || undefined,
    accountNumber:
      String(pickLoose(source, 'accountNumber', 'AccountNumber') ?? '').trim() || undefined,
  };
}
