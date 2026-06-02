/** Parse duration as a positive day count (plain number or leading digits). */
export function parseMaintenanceDurationDays(value: string | number | null | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    return n > 0 ? n : null;
  }
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const direct = Number(raw);
  if (Number.isFinite(direct) && direct > 0) {
    return Math.trunc(direct);
  }
  const match = raw.match(/^(\d+)/);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/** Parse `yyyy-MM-dd` (or ISO datetime) to a local calendar date. */
function parseIsoDateParts(iso: string): { y: number; m: number; d: number } | null {
  const trimmed = iso.trim();
  if (!trimmed) {
    return null;
  }
  const datePart = trimmed.slice(0, 10);
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    const ms = new Date(trimmed).getTime();
    if (Number.isNaN(ms)) {
      return null;
    }
    const d = new Date(ms);
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  return { y, m, d };
}

function formatIsoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * End date = start date + duration days (calendar days).
 * Example: start 2026-06-01, 3 days → end 2026-06-04.
 */
export function computeMaintenanceEndDate(
  startDate: string,
  durationDays: number,
): string | null {
  const days = Math.trunc(durationDays);
  if (days <= 0) {
    return null;
  }
  const parts = parseIsoDateParts(startDate);
  if (!parts) {
    return null;
  }
  const utc = Date.UTC(parts.y, parts.m - 1, parts.d + days);
  const end = new Date(utc);
  return formatIsoDate(end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate());
}
