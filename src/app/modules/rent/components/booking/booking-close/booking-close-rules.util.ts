import { parseFinishWallTimeMs } from '../booking-finish/booking-finish-billing.util';

export interface CloseRulesInput {
  checkoutMs: number;
  returnMs: number;
  checkoutOdom: number;
  returnOdom: number;
}

export interface CloseRulesSettings {
  /** `number_mints_late_forr_finshcontract` — max minutes from checkout on the same day. */
  allowedLateMinutes: number;
  /** `number_incres_km_for_finshcontract` — max driven km (return − checkout odometer). */
  allowedDrivenKm: number;
}

/** Same local calendar day as checkout (same-day return / quick close). */
export function isSameLocalDayAsCheckout(checkoutMs: number, returnMs: number): boolean {
  const checkout = new Date(checkoutMs);
  const ret = new Date(returnMs);
  return (
    checkout.getFullYear() === ret.getFullYear() &&
    checkout.getMonth() === ret.getMonth() &&
    checkout.getDate() === ret.getDate()
  );
}

export function closeReturnSameDayViolated(checkoutMs: number, returnMs: number): boolean {
  return !isSameLocalDayAsCheckout(checkoutMs, returnMs);
}

/** Minutes from checkout → actual return (same-day close compares these two times only). */
export function minutesFromCheckout(checkoutMs: number, returnMs: number): number {
  return Math.max(0, returnMs - checkoutMs) / 60_000;
}

export function minutesLateForClose(input: CloseRulesInput): number {
  return minutesFromCheckout(input.checkoutMs, input.returnMs);
}

export function closeMinutesGraceViolated(input: CloseRulesInput, settings: CloseRulesSettings): boolean {
  const allowed = Math.max(0, settings.allowedLateMinutes);
  if (allowed <= 0) {
    return false;
  }
  return minutesLateForClose(input) > allowed;
}

export function timeCloseViolated(input: CloseRulesInput, settings: CloseRulesSettings): boolean {
  if (closeReturnSameDayViolated(input.checkoutMs, input.returnMs)) {
    return true;
  }
  return closeMinutesGraceViolated(input, settings);
}

/** Driven km on the close screen: return odometer − checkout odometer. */
export function drivenKmForClose(checkoutOdom: number, returnOdom: number): number {
  return Math.max(0, Math.trunc(returnOdom - checkoutOdom));
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
