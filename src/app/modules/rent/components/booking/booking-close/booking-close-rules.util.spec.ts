import {
  CloseRulesInput,
  closeMinutesGraceViolated,
  closeReturnSameDayViolated,
  drivenKmForClose,
  kmCloseViolated,
  minutesFromCheckout,
  minutesLateForClose,
  timeCloseViolated,
} from './booking-close-rules.util';

function localMs(y: number, m: number, d: number, hh: number, mm: number): number {
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

describe('booking-close-rules', () => {
  const checkout = localMs(2026, 5, 3, 17, 18);
  const settings = { allowedLateMinutes: 30, allowedDrivenKm: 50 };

  const baseInput = (returnMs: number, returnOdom: number): CloseRulesInput => ({
    checkoutMs: checkout,
    returnMs,
    checkoutOdom: 15000,
    returnOdom,
  });

  it('uses driven km as return minus checkout odometer', () => {
    expect(drivenKmForClose(15000, 15600)).toBe(600);
    expect(kmCloseViolated(baseInput(checkout, 15600), settings)).toBe(true);
    expect(kmCloseViolated(baseInput(checkout, 15040), settings)).toBe(false);
  });

  it('requires return on the same calendar day as checkout', () => {
    const nextDay = localMs(2026, 5, 4, 17, 18);
    expect(closeReturnSameDayViolated(checkout, nextDay)).toBe(true);
    expect(timeCloseViolated(baseInput(nextDay, 15040), settings)).toBe(true);
  });

  it('compares checkout time with actual return on the same day (quick close)', () => {
    const returnHalfHourLater = localMs(2026, 5, 3, 17, 48);
    const returnFortyTwoMinLater = localMs(2026, 5, 3, 18, 0);

    expect(minutesFromCheckout(checkout, returnHalfHourLater)).toBeCloseTo(30, 0);
    expect(minutesLateForClose(baseInput(returnHalfHourLater, 15040))).toBeCloseTo(30, 0);
    expect(closeMinutesGraceViolated(baseInput(returnHalfHourLater, 15040), settings)).toBe(false);
    expect(timeCloseViolated(baseInput(returnHalfHourLater, 15040), settings)).toBe(false);

    expect(minutesLateForClose(baseInput(returnFortyTwoMinLater, 15040))).toBeCloseTo(42, 0);
    expect(closeMinutesGraceViolated(baseInput(returnFortyTwoMinLater, 15040), settings)).toBe(true);
    expect(timeCloseViolated(baseInput(returnFortyTwoMinLater, 15040), settings)).toBe(true);
  });
});
