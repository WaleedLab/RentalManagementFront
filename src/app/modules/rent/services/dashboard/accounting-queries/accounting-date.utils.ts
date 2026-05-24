import { PaymentCount } from '../../../../finance/models/payment-counts/payment-count.model';
import { JournalEntry } from '../../../../finance/models/journals/journal-entry.model';

export function toDateOnlyInput(value?: string | null): string {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return '';
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return raw.length >= 10 ? raw.slice(0, 10) : '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseDateBoundary(value: string | undefined, endOfDay: boolean): number | null {
  const raw = String(value ?? '').trim();
  if (!raw) {
    return null;
  }
  const dateOnly = raw.length >= 10 ? raw.slice(0, 10) : raw;
  const date = new Date(`${dateOnly}T${endOfDay ? '23:59:59' : '00:00:00'}`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

export function isWithinDateRange(
  iso: string | undefined,
  dateFrom?: string,
  dateTo?: string,
): boolean {
  if (!dateFrom && !dateTo) {
    return true;
  }
  const time = iso ? new Date(iso).getTime() : Number.NaN;
  if (!Number.isFinite(time)) {
    return !dateFrom && !dateTo;
  }
  const from = parseDateBoundary(dateFrom, false);
  const to = parseDateBoundary(dateTo, true);
  if (from !== null && time < from) {
    return false;
  }
  if (to !== null && time > to) {
    return false;
  }
  return true;
}

export function filterPaymentCountsByRange(
  items: PaymentCount[],
  dateFrom?: string,
  dateTo?: string,
): PaymentCount[] {
  return items.filter(item => isWithinDateRange(item.createdAt, dateFrom, dateTo));
}

export function filterJournalsByRange(
  items: JournalEntry[],
  dateFrom?: string,
  dateTo?: string,
): JournalEntry[] {
  return items.filter(item => isWithinDateRange(item.date, dateFrom, dateTo));
}

export function sumPaymentPaid(items: PaymentCount[]): number {
  return items.reduce((total, item) => total + (Number(item.paid) || 0), 0);
}

export function toDayKey(iso?: string): string | null {
  const input = toDateOnlyInput(iso);
  return input || null;
}

export function toMonthKey(iso?: string): string | null {
  const day = toDayKey(iso);
  return day ? day.slice(0, 7) : null;
}

export function sortKeysAsc(keys: string[]): string[] {
  return [...keys].sort((a, b) => a.localeCompare(b));
}
