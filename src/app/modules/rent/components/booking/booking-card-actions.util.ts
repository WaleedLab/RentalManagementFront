import { Booking } from '../../models';
import { canBookingTranslateToDebtAction } from './booking-translate-debt.util';

export { canBookingTranslateToDebtAction };

/** عقد معلّق (حادث أو تعليق مالي). */
export function isBookingSuspended(booking: Pick<Booking, 'status'> | null | undefined): boolean {
  const s = String(booking?.status ?? '').trim();
  return s === 'Suspended_due_to_accident' || s === 'Suspended_due_to_sum_money';
}

/** عقد محوّل إلى ذمم (`translate`). */
export function isBookingReceivables(
  booking: Pick<Booking, 'status'> | null | undefined,
): boolean {
  return String(booking?.status ?? '').trim() === 'translate';
}

/** إنهاء عبر صفحة `finish-suspended` (معلّق أو ذمم). */
export function isBookingFinishSuspendedFlow(
  booking: Pick<Booking, 'status'> | null | undefined,
): boolean {
  return isBookingSuspended(booking) || isBookingReceivables(booking);
}

/**
 * عقد مفتوح أو ممدد — كل الأزرار متاحة (الوحيدان اللذان يملكان صلاحية كاملة).
 */
export function isBookingFullActions(booking: Pick<Booking, 'status'> | null | undefined): boolean {
  const s = String(booking?.status ?? '').trim();
  return s === 'open' || s === 'extension';
}

/** عقد منتهٍ (`finsh`). */
export function isBookingFinished(booking: Pick<Booking, 'status'> | null | undefined): boolean {
  return String(booking?.status ?? '').trim() === 'finsh';
}

/** عقد مغلق (`close`). */
export function isBookingClosed(booking: Pick<Booking, 'status'> | null | undefined): boolean {
  return String(booking?.status ?? '').trim() === 'close';
}

export function canBookingCloseAction(booking: Booking): boolean {
  return isBookingFullActions(booking);
}

export function canBookingEditAction(booking: Booking): boolean {
  return isBookingFullActions(booking);
}

/** عقد معلّق — حادث. */
export function isBookingSuspendedDueToAccident(
  booking: Pick<Booking, 'status'> | null | undefined,
): boolean {
  return String(booking?.status ?? '').trim() === 'Suspended_due_to_accident';
}

/** عقد معلّق — تعليق مالي (قبل التحويل إلى ذمم). */
export function isBookingSuspendedDueToSumMoney(
  booking: Pick<Booking, 'status'> | null | undefined,
): boolean {
  return String(booking?.status ?? '').trim() === 'Suspended_due_to_sum_money';
}

/** مسار إنهاء العقد حسب الحالة. */
export function bookingFinishRoute(booking: Pick<Booking, 'id' | 'status'>): (string | number)[] {
  if (isBookingFinishSuspendedFlow(booking)) {
    return ['/booking', 'finish-suspended', booking.id];
  }
  return ['/booking', 'finish', booking.id];
}

/** مفتاح ترجمة زر الإنهاء. */
export function bookingFinishLabelKey(booking: Pick<Booking, 'status'>): string {
  if (isBookingSuspendedDueToAccident(booking)) {
    return 'Booking card finish after accident';
  }
  if (isBookingReceivables(booking)) {
    return 'Booking card finish after debt';
  }
  if (isBookingSuspendedDueToSumMoney(booking)) {
    return 'Booking card finish';
  }
  return 'Booking card finish';
}

/** صنف CSS لزر الإنهاء في البطاقات والتفاصيل. */
export function bookingFinishActionClass(booking: Pick<Booking, 'status'>): string {
  if (isBookingSuspendedDueToAccident(booking)) {
    return 'booking-card__action--finish-suspended-accident';
  }
  if (isBookingReceivables(booking) || isBookingSuspendedDueToSumMoney(booking)) {
    return 'booking-card__action--finish-suspended-debt';
  }
  return 'booking-card__action--finish';
}

/** صنف Bootstrap لزر الإنهاء في شريط التفاصيل. */
export function bookingFinishToolbarButtonClass(booking: Pick<Booking, 'status'>): string {
  if (isBookingSuspendedDueToAccident(booking)) {
    return 'btn-outline-danger';
  }
  if (isBookingReceivables(booking) || isBookingSuspendedDueToSumMoney(booking)) {
    return 'btn-outline-warning';
  }
  return 'btn-outline-success';
}

export function canBookingFinishAction(booking: Booking): boolean {
  return isBookingFullActions(booking) || isBookingFinishSuspendedFlow(booking);
}

export function canBookingPrintAction(booking: Booking): boolean {
  return (
    isBookingFullActions(booking) ||
    isBookingFinishSuspendedFlow(booking) ||
    isBookingFinished(booking) ||
    isBookingClosed(booking)
  );
}

export function canBookingSuspendAction(booking: Booking): boolean {
  return isBookingFullActions(booking);
}

export function canBookingExtendAction(booking: Booking): boolean {
  return isBookingFullActions(booking);
}

export type BookingCardActionId = 'view' | 'edit' | 'track' | 'close' | 'finish' | 'print';

const BOOKING_CARD_MAIN_ACTION_LIMIT = 3;

/** طباعة في الشريط الرئيسي (معلق / منتهٍ / مغلق). */
export function bookingCardPrintInMain(booking: Booking): boolean {
  return canBookingPrintAction(booking) && !isBookingFullActions(booking);
}

/** شريط الكرت: عرض → تعديل → إنهاء (حتى 3) — الباقي داخل ⋯ */
export function bookingCardMainActionIds(booking: Booking): BookingCardActionId[] {
  const main: BookingCardActionId[] = ['view'];

  if (canBookingEditAction(booking)) {
    main.push('edit');
  }
  if (canBookingFinishAction(booking)) {
    main.push('finish');
  }

  return main.slice(0, BOOKING_CARD_MAIN_ACTION_LIMIT);
}

export function bookingCardActionInMain(booking: Booking, action: BookingCardActionId): boolean {
  return bookingCardMainActionIds(booking).includes(action);
}

export function bookingCardCloseInMenu(booking: Booking): boolean {
  return canBookingCloseAction(booking) && !bookingCardActionInMain(booking, 'close');
}

export function bookingCardFinishInMenu(booking: Booking): boolean {
  return canBookingFinishAction(booking) && !bookingCardActionInMain(booking, 'finish');
}

/** طباعة داخل قائمة ⋯ (مفتوح / ممدد، أو عند امتلاء الشريط). */
export function bookingCardPrintInMenu(booking: Booking): boolean {
  if (!canBookingPrintAction(booking)) {
    return false;
  }
  if (isBookingFullActions(booking)) {
    return true;
  }
  return bookingCardPrintInMain(booking) && !bookingCardActionInMain(booking, 'print');
}

export function bookingCardTrackInMenu(booking: Booking): boolean {
  return !bookingCardActionInMain(booking, 'track');
}

export function bookingCardEditInMenu(booking: Booking): boolean {
  return canBookingEditAction(booking) && !bookingCardActionInMain(booking, 'edit');
}

/** إظهار قائمة ⋯ عند وجود إجراء واحد على الأقل (التتبع دائماً في القائمة). */
export function bookingCardMoreMenuVisible(booking: Booking): boolean {
  return (
    bookingCardTrackInMenu(booking) ||
    bookingCardEditInMenu(booking) ||
    canBookingTranslateToDebtAction(booking) ||
    canBookingSuspendAction(booking) ||
    canBookingExtendAction(booking) ||
    bookingCardPrintInMenu(booking) ||
    bookingCardCloseInMenu(booking) ||
    bookingCardFinishInMenu(booking)
  );
}
