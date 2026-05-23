import { Booking } from '../../models';

/** عقد معلّق (حادث أو مبلغ). */
export function isBookingSuspended(booking: Pick<Booking, 'status'> | null | undefined): boolean {
  const s = String(booking?.status ?? '').trim();
  return s === 'Suspended_due_to_accident' || s === 'Suspended_due_to_sum_money';
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

export function canBookingFinishAction(booking: Booking): boolean {
  return isBookingFullActions(booking) || isBookingSuspended(booking);
}

export function canBookingPrintAction(booking: Booking): boolean {
  return (
    isBookingFullActions(booking) ||
    isBookingSuspended(booking) ||
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

/** طباعة في الشريط الرئيسي (معلق / منتهٍ / مغلق). */
export function bookingCardPrintInMain(booking: Booking): boolean {
  return canBookingPrintAction(booking) && !isBookingFullActions(booking);
}

/** طباعة داخل قائمة ⋯ (مفتوح / ممدد). */
export function bookingCardPrintInMenu(booking: Booking): boolean {
  return canBookingPrintAction(booking) && isBookingFullActions(booking);
}

/** إظهار قائمة ⋯ فقط عند وجود إجراء واحد على الأقل. */
export function bookingCardMoreMenuVisible(booking: Booking): boolean {
  return (
    canBookingSuspendAction(booking) ||
    canBookingEditAction(booking) ||
    canBookingExtendAction(booking) ||
    bookingCardPrintInMenu(booking)
  );
}
