export const FINISH_MS_PER_DAY = 86_400_000;
export const FINISH_MS_PER_HOUR = 3_600_000;

export interface FinishBillingSettings {
  freeLateHours: number;
  /** `number_hour_late_forr_finshinday` — 0 disables the extra-day rule. */
  lateHoursPerDayCap: number;
}

export interface FinishBillingResult {
  /** Full 24h buckets from checkout → return (`floor(span ÷ 24h)`, min 1). */
  spanFloorDays: number;
  /** Billed days: span floor + 1 when remainder hours exceed the daily cap. */
  billableDays: number;
  /** Whole hours in span after full days (before free-hour deduction). */
  remainderDisplayHours: number;
  /** Billable extra hours after free allowance; 0 when an extra day is added. */
  chargeableHours: number;
  hourRuleAddsDay: boolean;
}

/**
 * Parse checkout/return as **local wall time** (`YYYY-MM-DDTHH:mm`) when possible,
 * so billing matches what the user sees in the date picker.
 */
export function parseFinishWallTimeMs(text: string | undefined): number | null {
  const t = String(text ?? '').trim();
  if (!t) {
    return null;
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(t);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] !== undefined && m[6] !== '' ? Number(m[6]) : 0;
    if (![y, mo, d, hh, mm, ss].every(n => Number.isFinite(n))) {
      return null;
    }
    const ms = new Date(y, mo - 1, d, hh, mm, ss).getTime();
    return Number.isNaN(ms) ? null : ms;
  }
  const ms = new Date(t).getTime();
  return Number.isNaN(ms) ? null : ms;
}

/**
 * Contract-finish billing from checkout → return.
 *
 * Hour rules apply to hours **above complete 24h days** in the rental span.
 * Grace minutes after contract end (`number_mints_late_forr_finshcontract`) are not
 * subtracted here — that setting is for closing the contract, not hourly billing.
 */
export function computeFinishBilling(
  checkoutMs: number,
  returnMs: number,
  settings: FinishBillingSettings,
): FinishBillingResult | null {
  if (!Number.isFinite(checkoutMs) || !Number.isFinite(returnMs) || returnMs < checkoutMs) {
    return null;
  }

  const spanMs = returnMs - checkoutMs;
  const spanFloorDays = Math.max(1, Math.floor(spanMs / FINISH_MS_PER_DAY));
  const remainderMs = spanMs % FINISH_MS_PER_DAY;
  const remainderHoursDecimal = remainderMs / FINISH_MS_PER_HOUR;

  const free = Math.max(0, settings.freeLateHours);
  const cap = Math.max(0, settings.lateHoursPerDayCap);
  const hourRuleAddsDay = cap > 0 && remainderHoursDecimal > cap;
  const billableDays = spanFloorDays + (hourRuleAddsDay ? 1 : 0);

  /** When over the daily late-hour cap, hours convert to a full day — show 0 here. */
  const remainderDisplayHours = hourRuleAddsDay
    ? 0
    : remainderMs > 0
      ? Math.floor(remainderHoursDecimal)
      : 0;

  let chargeableHours = 0;
  if (!hourRuleAddsDay && remainderHoursDecimal > free) {
    chargeableHours = Math.max(0, Math.floor(remainderHoursDecimal - free));
  }

  return {
    spanFloorDays,
    billableDays,
    remainderDisplayHours,
    chargeableHours,
    hourRuleAddsDay,
  };
}
