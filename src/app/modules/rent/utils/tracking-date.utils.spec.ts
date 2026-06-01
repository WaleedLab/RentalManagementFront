import {
  normalizeTrackingFilterRange,
  toTrackingBeginDateTime,
  toTrackingDateOnlyInput,
  toTrackingEndDateTime,
} from './tracking-date.utils';

describe('toTrackingDateOnlyInput', () => {
  it('keeps yyyy-MM-dd without timezone shift', () => {
    expect(toTrackingDateOnlyInput('2026-05-19')).toBe('2026-05-19');
  });

  it('uses local calendar day for Date instances', () => {
    const date = new Date(2026, 4, 19, 15, 30, 0);
    expect(toTrackingDateOnlyInput(date)).toBe('2026-05-19');
  });
});

describe('tracking query datetimes', () => {
  it('uses space-separated datetime for ASP.NET query binding', () => {
    expect(toTrackingBeginDateTime('2026-05-19')).toBe('2026-05-19 00:00:00');
    expect(toTrackingEndDateTime('2026-05-25')).toBe('2026-05-25 23:59:59');
  });
});

describe('normalizeTrackingFilterRange', () => {
  it('returns null when either date is missing', () => {
    expect(normalizeTrackingFilterRange('', '2026-05-19')).toBeNull();
  });

  it('swaps inverted ranges', () => {
    const range = normalizeTrackingFilterRange('2026-05-20', '2026-05-10');
    expect(range?.dateFrom).toBe('2026-05-10');
    expect(range?.dateTo).toBe('2026-05-20');
  });
});
