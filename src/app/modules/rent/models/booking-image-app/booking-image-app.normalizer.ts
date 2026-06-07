import { BookingImageApp } from './booking-image-app.model';

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
  if (value === null || value === undefined) {
    return undefined;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function trimText(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  const s = String(value).trim();
  return s || undefined;
}

export function normalizeBookingImageApp(raw: unknown): BookingImageApp {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = trimText(pickLoose(r, 'id', 'Id')) ?? '';
  const fleetId = trimText(pickLoose(r, 'idFleet', 'IdFleet', 'idFleetId', 'IdFleetId')) ?? '';

  return {
    id,
    fleetId,
    idBooking: toNumber(pickLoose(r, 'idBooking', 'IdBooking')) ?? 0,
    status: trimText(pickLoose(r, 'stutus', 'Stutus', 'status', 'Status')) ?? '',
    imageCounter: trimText(pickLoose(r, 'imageCounter', 'ImageCounter')),
    imageFront: trimText(pickLoose(r, 'imageFront', 'ImageFront')),
    imageBack: trimText(pickLoose(r, 'imageBack', 'ImageBack')),
    imageRight: trimText(pickLoose(r, 'imageRight', 'ImageRight')),
    imageLeft: trimText(pickLoose(r, 'imageLeft', 'ImageLeft')),
  };
}
