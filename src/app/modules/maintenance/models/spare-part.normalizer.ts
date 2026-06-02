import { SparePart } from './spare-part.model';

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

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function normalizeSparePart(raw: unknown): SparePart {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pickLoose(source, 'id', 'Id') ?? ''),
    fleetId: String(pickLoose(source, 'fleetId', 'FleetId') ?? ''),
    name: String(pickLoose(source, 'name', 'Name') ?? '').trim(),
    number: toNumber(pickLoose(source, 'number', 'Number')),
    description: String(pickLoose(source, 'description', 'Description') ?? '').trim() || undefined,
  };
}
