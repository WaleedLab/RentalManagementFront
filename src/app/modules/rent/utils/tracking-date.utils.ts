/** Normalizes API / ISO datetime to `yyyy-MM-dd` for filters and query params. */
export function toTrackingDateOnlyInput(value: string | Date | null | undefined): string {
  if (value == null || value === '') {
    return '';
  }
  const date = value instanceof Date ? value : new Date(String(value).trim());
  if (Number.isNaN(date.getTime())) {
    const isoDay = String(value).trim().slice(0, 10);
    return /^\d{4}-\d{2}-\d{2}$/.test(isoDay) ? isoDay : '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Matches backend GetTrackingQuery: `yyyy-MM-dd HH:mm:ss`. */
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
