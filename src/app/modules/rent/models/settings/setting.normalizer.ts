import { Setting } from './setting.model';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  }
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeSetting(raw: unknown): Setting {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: toNumber(pick(source, 'id', 'Id'), 0),
    number_hour_latefree: toNumber(pick(source, 'number_hour_latefree', 'Number_hour_latefree'), 0),
    number_mints_late_forr_finshcontract: toNumber(
      pick(source, 'number_mints_late_forr_finshcontract', 'Number_mints_late_forr_finshcontract'),
      0,
    ),
    number_hour_late_forr_finshinday: toNumber(
      pick(source, 'number_hour_late_forr_finshinday', 'Number_hour_late_forr_finshinday'),
      0,
    ),
    number_incres_km_for_finshcontract: toNumber(
      pick(source, 'number_incres_km_for_finshcontract', 'Number_incres_km_for_finshcontract'),
      0,
    ),
    minValue: toNumber(pick(source, 'minValue', 'MinValue'), 0),
    dateOfExp: toBoolean(pick(source, 'dateOfExp', 'DateOfExp')),
    dateOfExpWithNation: toBoolean(pick(source, 'dateOfExpWithNation', 'DateOfExpWithNation')),
    expDateAndInsuranceExp: toBoolean(pick(source, 'expDateAndInsuranceExp', 'ExpDateAndInsuranceExp')),
    oneBookingOrMore: toBoolean(pick(source, 'oneBookingOrMore', 'OneBookingOrMore')),
    bookingdebts: toBoolean(pick(source, 'bookingdebts', 'Bookingdebts')),
    bookingissues: toBoolean(pick(source, 'bookingissues', 'Bookingissues')),
    showBookingDistanceGps: toBoolean(pick(source, 'showBookingDistanceGps', 'ShowBookingDistanceGps')),
    tax: toNumber(pick(source, 'tax', 'Tax'), 0),
    fleetId: pick<string>(source, 'fleetId', 'FleetId'),
    isUpdate: toBoolean(pick(source, 'isUpdate', 'IsUpdate')),
  };
}

