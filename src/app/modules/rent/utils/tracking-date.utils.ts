/** Normalizes API / ISO datetime to `yyyy-MM-dd` (local calendar day, no timezone shift). */
export function toTrackingDateOnlyInput(value: string | Date | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      return '';
    }
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const trimmed = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    const isoDay = trimmed.slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? isoDay : '';
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Query datetime for `GetTrackingQuery.begindate` / `lastdate`.
 * Uses `yyyy-MM-dd HH:mm:ss`; HttpClient URL-encodes the space (`%20`) for reliable ASP.NET binding.
 */
export function toTrackingBeginDateTime(dateOnly: string): string {
  const day = String(dateOnly ?? '').trim();
  if (!day) {
    return '';
  }
  return `${day} 00:00:00`;
}

export function toTrackingEndDateTime(dateOnly: string): string {
  const day = String(dateOnly ?? '').trim();
  if (!day) {
    return '';
  }
  return `${day} 23:59:59`;
}

/** Ensures a valid, ordered range; caps end date to today (local). */
export function normalizeTrackingFilterRange(
  dateFrom: string,
  dateTo: string,
): { dateFrom: string; dateTo: string } | null {
  const from = toTrackingDateOnlyInput(dateFrom);
  const to = toTrackingDateOnlyInput(dateTo);
  if (!from || !to) {
    return null;
  }

  const fromDate = new Date(`${from}T00:00:00`);
  const toDate = new Date(`${to}T00:00:00`);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    return null;
  }

  const today = toTrackingDateOnlyInput(new Date());
  const cappedTo = to > today ? today : to;

  let normalizedFrom = from;
  let normalizedTo = cappedTo;
  if (normalizedFrom > normalizedTo) {
    const swap = normalizedFrom;
    normalizedFrom = normalizedTo;
    normalizedTo = swap;
  }

  const minSupported = '1900-05-01';
  if (normalizedFrom < minSupported) {
    normalizedFrom = minSupported;
  }

  return { dateFrom: normalizedFrom, dateTo: normalizedTo };
}
