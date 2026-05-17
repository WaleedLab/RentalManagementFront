import {
  FINISH_MS_PER_DAY,
  parseFinishWallTimeMs,
} from '../booking-finish/booking-finish-billing.util';

/** Planned return: API `endDate` when valid, else checkout + booked days × 24h. */
export function resolvePlannedReturnEndMs(
  checkoutMs: number,
  bookedDays: number,
  endDateIso: string | undefined,
): number {
  const endMs = parseFinishWallTimeMs(endDateIso);
  if (endMs !== null && endMs >= checkoutMs) {
    return endMs;
  }
  const days = Math.max(1, Math.trunc(bookedDays) || 1);
  return checkoutMs + days * FINISH_MS_PER_DAY;
}

export interface CloseRulesInput {
  checkoutMs: number;
  returnMs: number;
  checkoutOdom: number;
  returnOdom: number;
  bookedDays: number;
  endDateIso?: string;
}

export interface CloseRulesSettings {
  /** `number_mints_late_forr_finshcontract` — grace after planned return (anchored on checkout). */
  allowedLateMinutes: number;
  /** `number_incres_km_for_finshcontract` — max driven km (return − checkout odometer). */
  allowedDrivenKm: number;
}

/** Total minutes from checkout → return (informational). */
export function minutesFromCheckout(checkoutMs: number, returnMs: number): number {
  return Math.max(0, returnMs - checkoutMs) / 60_000;
}

/**
 * Planned return = `endDate` when valid, else checkout + booked days (same clock as checkout).
 * Late minutes for close = return − planned return.
 */
export function minutesLateForClose(input: CloseRulesInput): number {
  const plannedEndMs = resolvePlannedReturnEndMs(
    input.checkoutMs,
    input.bookedDays,
    input.endDateIso,
  );
  return Math.max(0, input.returnMs - plannedEndMs) / 60_000;
}

/** Driven km on the close screen: return odometer − checkout odometer. */
export function drivenKmForClose(checkoutOdom: number, returnOdom: number): number {
  return Math.max(0, Math.trunc(returnOdom - checkoutOdom));
}

export function timeCloseViolated(input: CloseRulesInput, settings: CloseRulesSettings): boolean {
  const allowed = Math.max(0, settings.allowedLateMinutes);
  if (allowed <= 0) {
    return false;
  }
  return minutesLateForClose(input) > allowed;
}

export function kmCloseViolated(input: CloseRulesInput, settings: CloseRulesSettings): boolean {
  const limit = Math.max(0, settings.allowedDrivenKm);
  if (limit <= 0) {
    return false;
  }
  return drivenKmForClose(input.checkoutOdom, input.returnOdom) > limit;
}

export function resolveCheckoutMs(
  startDateIso: string | undefined,
  pickupDateIso: string | undefined,
): number | null {
  const pickup = String(pickupDateIso ?? '').trim();
  if (pickup) {
    const ms = parseFinishWallTimeMs(pickup) ?? parseFinishWallTimeMs(startDateIso);
    if (ms !== null) {
      return ms;
    }
  }
  return parseFinishWallTimeMs(startDateIso);
}
