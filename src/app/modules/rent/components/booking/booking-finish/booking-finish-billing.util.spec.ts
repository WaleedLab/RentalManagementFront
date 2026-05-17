import { FINISH_MS_PER_DAY, computeFinishBilling, parseFinishWallTimeMs } from './booking-finish-billing.util';

function localMs(y: number, m: number, d: number, hh: number, mm: number): number {
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

describe('parseFinishWallTimeMs', () => {
  it('parses datetime-local strings as local wall time', () => {
    expect(parseFinishWallTimeMs('2026-05-17T18:19')).toBe(localMs(2026, 5, 17, 18, 19));
  });
});

describe('computeFinishBilling', () => {
  const checkout = localMs(2026, 5, 10, 10, 0);
  const settings = { freeLateHours: 2, lateHoursPerDayCap: 6 };

  it('counts 3 chargeable hours when span is 3d + 5h30m and free is 2', () => {
    const ret = localMs(2026, 5, 13, 15, 30);
    const r = computeFinishBilling(checkout, ret, settings)!;
    expect(r.remainderDisplayHours).toBe(5);
    expect(r.chargeableHours).toBe(3);
  });

  it('adds a billable day when remainder exceeds the daily cap', () => {
    const ret = localMs(2026, 5, 13, 18, 30);
    const r = computeFinishBilling(checkout, ret, settings)!;
    expect(r.billableDays).toBe(4);
    expect(r.remainderDisplayHours).toBe(0);
    expect(r.chargeableHours).toBe(0);
  });

  it('zeros hours over full days when remainder exceeds cap of 5', () => {
    const ret = localMs(2026, 5, 13, 16, 0);
    const r = computeFinishBilling(checkout, ret, { freeLateHours: 2, lateHoursPerDayCap: 5 })!;
    expect(r.remainderDisplayHours).toBe(0);
    expect(r.billableDays).toBe(4);
    expect(r.hourRuleAddsDay).toBe(true);
  });

  it('counts the first hour when return is 14d + 1h after checkout', () => {
    const longCheckout = localMs(2026, 5, 3, 17, 18);
    const ret = localMs(2026, 5, 17, 18, 19);
    const r = computeFinishBilling(longCheckout, ret, { freeLateHours: 0, lateHoursPerDayCap: 6 })!;
    expect(r.spanFloorDays).toBe(14);
    expect(r.billableDays).toBe(14);
    expect(r.remainderDisplayHours).toBe(1);
    expect(r.chargeableHours).toBe(1);
  });

  it('would have zeroed the hour if grace were wrongly applied to remainder', () => {
    const longCheckout = localMs(2026, 5, 3, 17, 18);
    const ret = localMs(2026, 5, 17, 18, 19);
    const spanMs = ret - longCheckout;
    const remainderMs = spanMs % FINISH_MS_PER_DAY;
    expect(remainderMs).toBeGreaterThanOrEqual(3_600_000);
  });
});
