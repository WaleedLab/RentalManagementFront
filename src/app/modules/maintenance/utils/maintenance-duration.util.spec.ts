import {
  computeMaintenanceEndDate,
  parseMaintenanceDurationDays,
} from './maintenance-duration.util';

describe('maintenance-duration.util', () => {
  it('parses day count from number or string', () => {
    expect(parseMaintenanceDurationDays(3)).toBe(3);
    expect(parseMaintenanceDurationDays('5')).toBe(5);
    expect(parseMaintenanceDurationDays('7 days')).toBe(7);
    expect(parseMaintenanceDurationDays('')).toBeNull();
  });

  it('computes end date as start plus duration days', () => {
    expect(computeMaintenanceEndDate('2026-06-01', 3)).toBe('2026-06-04');
    expect(computeMaintenanceEndDate('2026-12-28', 5)).toBe('2027-01-02');
  });
});
