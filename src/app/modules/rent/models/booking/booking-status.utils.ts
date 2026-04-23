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

const BOOKING_INT_BY_ENUM: Partial<Record<BookingStatus, number>> = Object.entries(BOOKING_ENUM_BY_INT).reduce(
  (acc, [code, status]) => {
    acc[status] = Number(code);
    return acc;
  },
  {} as Partial<Record<BookingStatus, number>>,
);

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

export function bookingStatusCode(status: BookingStatus): number | null {
  return BOOKING_INT_BY_ENUM[status] ?? null;
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

export type BookingStatusKey =
  | 'open'
  | 'finsh'
  | 'Suspended_due_to_accident'
  | 'translate'
  | 'close'
  | 'extension'
  | 'Suspended_due_to_sum_money'
  | 'Payment_on_account'
  | 'Unknown';

export interface BookingStatusTheme {
  labelAr: string;
  labelEn: string;
  iconClass: string;
  color: string;
  textColor: string;
  bgLight: string;
  bgDark: string;
  borderLight: string;
  borderDark: string;
  gradient: string;
  chartColor: string;
}

export const BOOKING_STATUS_THEME: Record<BookingStatusKey, BookingStatusTheme> = {
  open: {
    labelAr: 'مفتوح',
    labelEn: 'Open',
    iconClass: 'fa-solid fa-circle-play',
    color: '#16A34A',
    textColor: '#ffffff',
    bgLight: '#DCFCE7',
    bgDark: '#14532D',
    borderLight: '#86EFAC',
    borderDark: '#22C55E',
    gradient: 'linear-gradient(135deg, #22C55E 0%, #16A34A 100%)',
    chartColor: '#16A34A',
  },
  finsh: {
    labelAr: 'منتهي',
    labelEn: 'Finished',
    iconClass: 'fa-solid fa-circle-xmark',
    color: '#DC2626',
    textColor: '#ffffff',
    bgLight: '#FEE2E2',
    bgDark: '#7F1D1D',
    borderLight: '#FCA5A5',
    borderDark: '#F87171',
    gradient: 'linear-gradient(135deg, #EF4444 0%, #B91C1C 100%)',
    chartColor: '#DC2626',
  },
  Suspended_due_to_accident: {
    labelAr: 'معلق بسبب حادث',
    labelEn: 'Suspended - Accident',
    iconClass: 'fa-solid fa-car-burst',
    color: '#EA580C',
    textColor: '#ffffff',
    bgLight: '#FFEDD5',
    bgDark: '#7C2D12',
    borderLight: '#FDBA74',
    borderDark: '#FB923C',
    gradient: 'linear-gradient(135deg, #F97316 0%, #EA580C 100%)',
    chartColor: '#EA580C',
  },
  translate: {
    labelAr: 'تحويل',
    labelEn: 'Transferred',
    iconClass: 'fa-solid fa-right-left',
    color: '#7C3AED',
    textColor: '#ffffff',
    bgLight: '#EDE9FE',
    bgDark: '#4C1D95',
    borderLight: '#C4B5FD',
    borderDark: '#A78BFA',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)',
    chartColor: '#7C3AED',
  },
  close: {
    labelAr: 'مغلق',
    labelEn: 'Closed',
    iconClass: 'fa-solid fa-lock',
    color: '#374151',
    textColor: '#ffffff',
    bgLight: '#E5E7EB',
    bgDark: '#111827',
    borderLight: '#9CA3AF',
    borderDark: '#6B7280',
    gradient: 'linear-gradient(135deg, #4B5563 0%, #374151 100%)',
    chartColor: '#374151',
  },
  extension: {
    labelAr: 'تمديد',
    labelEn: 'Extension',
    iconClass: 'fa-solid fa-clock-rotate-left',
    color: '#F59E0B',
    textColor: '#ffffff',
    bgLight: '#FEF3C7',
    bgDark: '#78350F',
    borderLight: '#FCD34D',
    borderDark: '#FBBF24',
    gradient: 'linear-gradient(135deg, #FBBF24 0%, #F59E0B 100%)',
    chartColor: '#F59E0B',
  },
  Suspended_due_to_sum_money: {
    labelAr: 'معلق بسبب مبلغ مالي',
    labelEn: 'Suspended - Amount Due',
    iconClass: 'fa-solid fa-building-columns',
    color: '#1D4ED8',
    textColor: '#ffffff',
    bgLight: '#DBEAFE',
    bgDark: '#1E3A8A',
    borderLight: '#93C5FD',
    borderDark: '#60A5FA',
    gradient: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
    chartColor: '#1D4ED8',
  },
  Payment_on_account: {
    labelAr: 'دفعة على الحساب',
    labelEn: 'Payment on Account',
    iconClass: 'fa-solid fa-money-check-dollar',
    color: '#10B981',
    textColor: '#ffffff',
    bgLight: '#D1FAE5',
    bgDark: '#064E3B',
    borderLight: '#6EE7B7',
    borderDark: '#34D399',
    gradient: 'linear-gradient(135deg, #34D399 0%, #10B981 100%)',
    chartColor: '#10B981',
  },
  Unknown: {
    labelAr: 'غير معروف',
    labelEn: 'Unknown',
    iconClass: 'fa-solid fa-circle-question',
    color: '#64748B',
    textColor: '#ffffff',
    bgLight: '#E2E8F0',
    bgDark: '#334155',
    borderLight: '#94A3B8',
    borderDark: '#64748B',
    gradient: 'linear-gradient(135deg, #94A3B8 0%, #64748B 100%)',
    chartColor: '#64748B',
  },
};

export function getBookingStatusTheme(status: string): BookingStatusTheme {
  const key = (status || 'Unknown') as BookingStatusKey;
  return BOOKING_STATUS_THEME[key] ?? BOOKING_STATUS_THEME.Unknown;
}

export function getBookingLegendItems(): Array<{
  key: BookingStatusKey;
  labelAr: string;
  labelEn: string;
  color: string;
  iconClass: string;
}> {
  return (Object.entries(BOOKING_STATUS_THEME) as Array<[BookingStatusKey, BookingStatusTheme]>).map(
    ([key, value]) => ({
      key,
      labelAr: value.labelAr,
      labelEn: value.labelEn,
      color: value.chartColor,
      iconClass: value.iconClass,
    }),
  );
}
