import { BookingStatus } from './booking.model';

/**
 * Default `Stutus` for new bookings — matches `bookingEnum.open.ToString()` in EF
 * (`BookingConfiguration`: string column, max 50). Do not send numeric `0`; the DB expects the enum name string.
 */
export const BOOKING_CREATE_DEFAULT_STUTUS = 'open' as const;

/** Mirrors CarRentalManagament.Application.Common.Enums.bookingEnum */
const BOOKING_ENUM_BY_INT: Record<number, BookingStatus> = {
  0: 'open',
  1: 'finsh',
  2: 'Suspended_due_to_accident',
  3: 'translate',
  4: 'close',
  5: 'extension',
  6: 'Suspended_due_to_sum_money',
  7: 'Payment_on_account',
};

export function bookingStatusFromCode(code: unknown): BookingStatus {
  if (typeof code === 'number' && Number.isFinite(code)) {
    const mapped = BOOKING_ENUM_BY_INT[code];
    if (mapped) {
      return mapped;
    }
  }
  if (typeof code === 'string') {
    const raw = code.trim();
    const n = Number(raw);
    if (!Number.isNaN(n) && raw !== '' && BOOKING_ENUM_BY_INT[n]) {
      return BOOKING_ENUM_BY_INT[n];
    }
    const s = raw;
    /** JsonStringEnumConverter camelCase names */
    const camelEnum: Record<string, BookingStatus> = {
      open: 'open',
      finsh: 'finsh',
      suspendedDueToAccident: 'Suspended_due_to_accident',
      translate: 'translate',
      close: 'close',
      extension: 'extension',
      suspendedDueToSumMoney: 'Suspended_due_to_sum_money',
      paymentOnAccount: 'Payment_on_account',
    };
    if (camelEnum[s]) {
      return camelEnum[s];
    }
    /** PascalCase (some serializers) */
    const pascalEnum: Record<string, BookingStatus> = {
      Open: 'open',
      Finsh: 'finsh',
      Suspended_due_to_accident: 'Suspended_due_to_accident',
      Translate: 'translate',
      Close: 'close',
      Extension: 'extension',
      Suspended_due_to_sum_money: 'Suspended_due_to_sum_money',
      Payment_on_account: 'Payment_on_account',
    };
    if (pascalEnum[s]) {
      return pascalEnum[s];
    }
    if (
      [
        'open',
        'finsh',
        'Suspended_due_to_accident',
        'translate',
        'close',
        'extension',
        'Suspended_due_to_sum_money',
        'Payment_on_account',
      ].includes(s)
    ) {
      return s as BookingStatus;
    }
    const legacy: Record<string, BookingStatus> = {
      Draft: 'open',
      Confirmed: 'open',
      Active: 'open',
      Completed: 'finsh',
      Cancelled: 'close',
    };
    if (legacy[s]) {
      return legacy[s];
    }
  }
  return 'Unknown';
}

export function bookingStatusTranslationKey(status: BookingStatus): string {
  return `Booking status.${status}`;
}

export function bookingStatusTone(
  status: BookingStatus,
): 'success' | 'warning' | 'danger' | 'secondary' | 'info' {
  switch (status) {
    case 'finsh':
    case 'close':
      return 'success';
    case 'Suspended_due_to_accident':
    case 'Suspended_due_to_sum_money':
      return 'warning';
    case 'translate':
    case 'extension':
      return 'info';
    case 'Payment_on_account':
      return 'secondary';
    case 'open':
      return 'info';
    default:
      return 'secondary';
  }
}
