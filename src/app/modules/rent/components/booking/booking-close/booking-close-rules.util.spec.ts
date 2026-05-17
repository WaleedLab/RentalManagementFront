import {
  CloseRulesInput,
  drivenKmForClose,
  kmCloseViolated,
  minutesLateForClose,
  timeCloseViolated,
} from './booking-close-rules.util';

function localMs(y: number, m: number, d: number, hh: number, mm: number): number {
  return new Date(y, m - 1, d, hh, mm, 0, 0).getTime();
}

describe('booking-close-rules', () => {
  const checkout = localMs(2026, 5, 3, 17, 18);
  const bookedDays = 8;

  const baseInput = (returnMs: number, returnOdom: number): CloseRulesInput => ({
    checkoutMs: checkout,
    returnMs,
    checkoutOdom: 15000,
    returnOdom,
    bookedDays,
  });

  it('uses driven km as return minus checkout odometer', () => {
    expect(drivenKmForClose(15000, 15600)).toBe(600);
    expect(kmCloseViolated(baseInput(checkout, 15600), { allowedLateMinutes: 30, allowedDrivenKm: 50 })).toBe(
      true,
    );
    expect(kmCloseViolated(baseInput(checkout, 15040), { allowedLateMinutes: 30, allowedDrivenKm: 50 })).toBe(
      false,
    );
  });

  it('measures late minutes after planned return from checkout anchor', () => {
    const plannedEnd = localMs(2026, 5, 11, 17, 18);
    const returnOnTime = localMs(2026, 5, 11, 17, 40);
    const returnLate = localMs(2026, 5, 11, 18, 30);
    expect(minutesLateForClose(baseInput(returnOnTime, 15040))).toBeCloseTo(22, 0);
    expect(minutesLateForClose(baseInput(returnLate, 15040))).toBeCloseTo(72, 0);
    expect(
      timeCloseViolated(baseInput(returnOnTime, 15040), {
        allowedLateMinutes: 30,
        allowedDrivenKm: 50,
      }),
    ).toBe(false);
    expect(
      timeCloseViolated(baseInput(returnLate, 15040), {
        allowedLateMinutes: 30,
        allowedDrivenKm: 50,
      }),
    ).toBe(true);
    expect(plannedEnd).toBeLessThan(returnLate);
  });
});
