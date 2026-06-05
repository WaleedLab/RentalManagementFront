import { TrafficViolation } from './traffic-violation.model';

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

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (value !== undefined && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return undefined;
}

function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function bookingLabelFromNested(booking: Record<string, unknown> | undefined): string | undefined {
  if (!booking) return undefined;
  const num =
    pickLoose(booking, 'numberBookingINBasame', 'NumberBookingINBasame', 'numberBooking', 'NumberBooking') ??
    pickLoose(booking, 'id', 'Id');
  const cust = pickLoose(booking, 'customerNameAr', 'CustomerNameAr', 'nameAr', 'NameAr');
  const parts = [cust, num].map(v => (v !== undefined && v !== null ? String(v).trim() : '')).filter(Boolean);
  return parts.length ? parts.join(' · ') : undefined;
}

function vehiclePlateFromNested(vehicle: Record<string, unknown> | undefined): string | undefined {
  if (!vehicle) return undefined;
  const plate =
    pickLoose(vehicle, 'plantnumber', 'Plantnumber', 'plateNumber', 'PlateNumber', 'platNumber') ?? '';
  return String(plate).trim() || undefined;
}

function vehiclePlateFromRoot(r: Record<string, unknown>): string | undefined {
  const direct = pickLoose(
    r,
    'vehiclePlate',
    'VehiclePlate',
    'vehiclePlateNumber',
    'VehiclePlateNumber',
    'plateNumber',
    'PlateNumber',
    'plantnumber',
    'Plantnumber',
  );
  return direct !== undefined && direct !== null ? String(direct).trim() || undefined : undefined;
}

export function normalizeTrafficViolation(raw: unknown): TrafficViolation {
  const r = (raw ?? {}) as Record<string, unknown>;
  const id = toNumber(pickLoose(r, 'id', 'Id')) ?? 0;
  const booking = asRecord(pickLoose(r, 'booking', 'Booking'));
  const vehicle = asRecord(pickLoose(r, 'vehicle', 'Vehicle'));

  const rawBookingId = pickLoose(r, 'idBooking', 'IdBooking');
  const parsedBooking = toNumber(rawBookingId);
  const idBooking =
    rawBookingId === null || rawBookingId === undefined || rawBookingId === ''
      ? null
      : parsedBooking !== undefined && parsedBooking > 0
        ? parsedBooking
        : null;

  return {
    id: String(id),
    nameViolation: String(pickLoose(r, 'nameViolation', 'NameViolation') ?? '').trim() || undefined,
    idBooking,
    idVehicle: toNumber(pickLoose(r, 'idVehicle', 'IdVehicle')) ?? 0,
    bookingLabel: bookingLabelFromNested(booking),
    vehiclePlate: vehiclePlateFromRoot(r) ?? vehiclePlateFromNested(vehicle),
    dateViolation: String(pickLoose(r, 'dateViolation', 'DateViolation') ?? ''),
    violationFine: toNumber(pickLoose(r, 'violationFine', 'ViolationFine')) ?? 0,
    description: String(pickLoose(r, 'description', 'Description') ?? '').trim() || undefined,
    numberViolation: toNumber(pickLoose(r, 'numberViolation', 'NumberViolation')) ?? 0,
    fleetId: String(pickLoose(r, 'fleetId', 'FleetId') ?? '').trim() || undefined,
    createdAt: String(pickLoose(r, 'createdAt', 'CreatedAt') ?? '').trim() || undefined,
    updatedAt: String(pickLoose(r, 'updatedAt', 'UpdatedAt') ?? '').trim() || undefined,
  };
}
