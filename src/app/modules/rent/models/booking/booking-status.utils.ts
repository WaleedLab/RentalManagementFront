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
    color: '#5B7A9E',
    textColor: '#f8fafc',
    bgLight: '#E9EEF5',
    bgDark: '#243B52',
    borderLight: '#CFDAE8',
    borderDark: '#7A92AC',
    gradient: 'linear-gradient(145deg, #94ABC4 0%, #6D87A8 100%)',
    chartColor: '#5B7A9E',
  },
  finsh: {
    labelAr: 'مصفى',
    labelEn: 'Finished',
    iconClass: 'fa-solid fa-circle-xmark',
    color: '#558A6C',
    textColor: '#f8fafc',
    bgLight: '#E7F0EA',
    bgDark: '#234030',
    borderLight: '#B8D4C4',
    borderDark: '#6FA384',
    gradient: 'linear-gradient(145deg, #9BB8A8 0%, #679578 100%)',
    chartColor: '#558A6C',
  },
  Suspended_due_to_accident: {
    labelAr: 'معلق بسبب حادث',
    labelEn: 'Suspended - Accident',
    iconClass: 'fa-solid fa-car-burst',
    color: '#5C6773',
    textColor: '#f8fafc',
    bgLight: '#E8EAED',
    bgDark: '#2A3441',
    borderLight: '#C0C5CD',
    borderDark: '#75808D',
    gradient: 'linear-gradient(145deg, #8895A3 0%, #5A6672 100%)',
    chartColor: '#5C6773',
  },
  translate: {
    labelAr: 'تحويل',
    labelEn: 'Transferred',
    iconClass: 'fa-solid fa-right-left',
    color: '#6D6290',
    textColor: '#f8fafc',
    bgLight: '#EBE8F2',
    bgDark: '#3A3158',
    borderLight: '#C9C0DA',
    borderDark: '#8B7EAA',
    gradient: 'linear-gradient(145deg, #A598BF 0%, #7B6E9E 100%)',
    chartColor: '#6D6290',
  },
  close: {
    labelAr: 'مغلق',
    labelEn: 'Closed',
    iconClass: 'fa-solid fa-lock',
    color: '#6D727A',
    textColor: '#f8fafc',
    bgLight: '#ECECED',
    bgDark: '#363A40',
    borderLight: '#C8CACF',
    borderDark: '#868A92',
    gradient: 'linear-gradient(145deg, #9A9EA6 0%, #6F737B 100%)',
    chartColor: '#6D727A',
  },
  extension: {
    labelAr: 'تمديد',
    labelEn: 'Extension',
    iconClass: 'fa-solid fa-clock-rotate-left',
    color: '#9E7840',
    textColor: '#2d261c',
    bgLight: '#F7F1E8',
    bgDark: '#4A3B26',
    borderLight: '#E0D4C4',
    borderDark: '#C4AE88',
    gradient: 'linear-gradient(180deg, #f3eadb 0%, #e4d4bc 100%)',
    chartColor: '#9E7840',
  },
  Suspended_due_to_sum_money: {
    labelAr: 'معلق بسبب مبلغ مالي',
    labelEn: 'Suspended - Amount Due',
    iconClass: 'fa-solid fa-building-columns',
    color: '#546E7A',
    textColor: '#f8fafc',
    bgLight: '#E6ECEF',
    bgDark: '#243844',
    borderLight: '#B5C4CC',
    borderDark: '#6F8794',
    gradient: 'linear-gradient(145deg, #7F939E 0%, #526B78 100%)',
    chartColor: '#546E7A',
  },
  Payment_on_account: {
    labelAr: 'دفعة على الحساب',
    labelEn: 'Payment on Account',
    iconClass: 'fa-solid fa-money-check-dollar',
    color: '#4A8B7A',
    textColor: '#f8fafc',
    bgLight: '#E4F2EE',
    bgDark: '#1D4339',
    borderLight: '#A8D4C8',
    borderDark: '#5CA890',
    gradient: 'linear-gradient(145deg, #8BC4B4 0%, #559882 100%)',
    chartColor: '#4A8B7A',
  },
  Unknown: {
    labelAr: 'غير معروف',
    labelEn: 'Unknown',
    iconClass: 'fa-solid fa-circle-question',
    color: '#75808E',
    textColor: '#f8fafc',
    bgLight: '#E8EBEF',
    bgDark: '#3A4250',
    borderLight: '#B9C0CA',
    borderDark: '#8A939F',
    gradient: 'linear-gradient(145deg, #A8B0BC 0%, #7C8694 100%)',
    chartColor: '#75808E',
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
