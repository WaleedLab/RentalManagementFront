import { InsuranceCompany } from './insurance-company.model';

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

export function normalizeInsuranceCompany(raw: unknown): InsuranceCompany {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pickLoose(source, 'id', 'Id') ?? ''),
    fleetId: String(pickLoose(source, 'fleetId', 'FleetId') ?? ''),
    name: String(pickLoose(source, 'name', 'Name') ?? '').trim(),
    address: String(pickLoose(source, 'address', 'Address') ?? '').trim() || undefined,
    phoneNumber: String(pickLoose(source, 'phoneNumber', 'PhoneNumber') ?? '').trim() || undefined,
  };
}
