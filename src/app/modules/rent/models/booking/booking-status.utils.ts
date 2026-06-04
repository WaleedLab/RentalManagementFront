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
      return 'success';
    case 'close':
      return 'secondary';
    case 'Suspended_due_to_accident':
      return 'danger';
    case 'Suspended_due_to_sum_money':
      return 'warning';
    case 'translate':
    case 'extension':
      return 'info';
    case 'Payment_on_account':
      return 'info';
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

/** Token slug in `_color-system.scss` → `--app-booking-status-{slug}*` */
type BookingStatusTokenSlug =
  | 'open'
  | 'extension'
  | 'finished'
  | 'closed'
  | 'accident'
  | 'debt'
  | 'translate'
  | 'payment'
  | 'unknown';

function bookingStatusThemeFromTokens(
  meta: Pick<BookingStatusTheme, 'labelAr' | 'labelEn' | 'iconClass'>,
  slug: BookingStatusTokenSlug,
): BookingStatusTheme {
  const base = `--app-booking-status-${slug}`;
  return {
    ...meta,
    color: `var(${base})`,
    textColor: `var(${base}-fg)`,
    bgLight: `var(${base}-surface)`,
    bgDark: `var(${base}-surface-strong)`,
    borderLight: `var(${base}-border)`,
    borderDark: `var(${base}-border)`,
    gradient: `var(${base}-badge)`,
    chartColor: `var(${base})`,
  };
}

/** Muted operational palette — values live in `src/styles/_color-system.scss`. */
export const BOOKING_STATUS_THEME: Record<BookingStatusKey, BookingStatusTheme> = {
  open: bookingStatusThemeFromTokens(
    { labelAr: 'مفتوح', labelEn: 'Open', iconClass: 'fa-solid fa-circle-play' },
    'open',
  ),
  finsh: bookingStatusThemeFromTokens(
    { labelAr: 'مصفى', labelEn: 'Finished', iconClass: 'fa-solid fa-circle-check' },
    'finished',
  ),
  Suspended_due_to_accident: bookingStatusThemeFromTokens(
    { labelAr: 'حادث', labelEn: 'Accident', iconClass: 'fa-solid fa-car-burst' },
    'accident',
  ),
  translate: bookingStatusThemeFromTokens(
    { labelAr: 'تحويل', labelEn: 'Transferred', iconClass: 'fa-solid fa-right-left' },
    'translate',
  ),
  close: bookingStatusThemeFromTokens(
    { labelAr: 'إغلاق', labelEn: 'Closed', iconClass: 'fa-solid fa-lock' },
    'closed',
  ),
  extension: bookingStatusThemeFromTokens(
    { labelAr: 'تمديد', labelEn: 'Extension', iconClass: 'fa-solid fa-clock-rotate-left' },
    'extension',
  ),
  Suspended_due_to_sum_money: bookingStatusThemeFromTokens(
    { labelAr: 'ذمم', labelEn: 'Amount due', iconClass: 'fa-solid fa-building-columns' },
    'debt',
  ),
  Payment_on_account: bookingStatusThemeFromTokens(
    {
      labelAr: 'دفعة على الحساب',
      labelEn: 'Payment on Account',
      iconClass: 'fa-solid fa-money-check-dollar',
    },
    'payment',
  ),
  Unknown: bookingStatusThemeFromTokens(
    { labelAr: 'غير معروف', labelEn: 'Unknown', iconClass: 'fa-solid fa-circle-question' },
    'unknown',
  ),
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

/** Primary statuses shown in the booking list color guide (most common). */
export const BOOKING_LIST_COLOR_GUIDE_KEYS: BookingStatusKey[] = [
  'open',
  'extension',
  'finsh',
  'close',
  'Suspended_due_to_accident',
  'Suspended_due_to_sum_money',
];

/** CSS modifier for booking list card status accent (uses --app-booking-list-accent-* tokens). */
export function getBookingListCardStatusClass(status: string): string {
  const key = bookingStatusFromCode(status);
  switch (key) {
    case 'open':
      return 'booking-card--status-open';
    case 'extension':
      return 'booking-card--status-extension';
    case 'finsh':
      return 'booking-card--status-finished';
    case 'close':
      return 'booking-card--status-closed';
    case 'Suspended_due_to_accident':
      return 'booking-card--status-suspended-accident';
    case 'Suspended_due_to_sum_money':
      return 'booking-card--status-suspended-debt';
    default:
      return 'booking-card--status-unknown';
  }
}

export function getBookingListColorGuideItems(
  lang: string,
): Array<{ key: BookingStatusKey; label: string; color: string }> {
  const useAr = (lang || 'ar').toLowerCase().startsWith('ar');
  return BOOKING_LIST_COLOR_GUIDE_KEYS.map(key => {
    const theme = BOOKING_STATUS_THEME[key];
    return {
      key,
      label: useAr ? theme.labelAr : theme.labelEn,
      /** نفس لون الشارة على كرت الحجز (`theme.color`). */
      color: theme.color,
    };
  });
}

/** CSS custom properties for status-tinted surfaces (cards, hero cells, badges). */
export function getBookingStatusSurfaceStyle(status: string): Record<string, string> {
  const theme = getBookingStatusTheme(status);
  return {
    '--booking-status-bg-light': theme.bgLight,
    '--booking-status-bg-dark': theme.bgDark,
    '--booking-status-border-light': theme.borderLight,
    '--booking-status-border-dark': theme.borderDark,
    '--booking-status-accent': theme.color,
    '--booking-status-chart': theme.chartColor,
  };
}

export function getBookingStatusBadgeStyle(status: string): Record<string, string> {
  const theme = getBookingStatusTheme(status);
  return {
    '--booking-badge-bg': theme.gradient,
    '--booking-badge-color': theme.textColor,
    '--booking-badge-border-light': theme.borderLight,
    '--booking-badge-border-dark': theme.borderDark,
    background: theme.gradient,
    color: theme.textColor,
    borderColor: theme.borderLight,
  };
}
