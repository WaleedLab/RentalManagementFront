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

export type BookingCardActionId = 'view' | 'track' | 'close' | 'finish' | 'print';

const BOOKING_CARD_MAIN_ACTION_LIMIT = 3;

/** طباعة في الشريط الرئيسي (معلق / منتهٍ / مغلق). */
export function bookingCardPrintInMain(booking: Booking): boolean {
  return canBookingPrintAction(booking) && !isBookingFullActions(booking);
}

/** أول 3 إجراءات فقط في الشريط — الباقي داخل ⋯ */
export function bookingCardMainActionIds(booking: Booking): BookingCardActionId[] {
  const main: BookingCardActionId[] = ['view', 'track'];
  const optional: BookingCardActionId[] = [];

  if (canBookingFinishAction(booking)) {
    optional.push('finish');
  }
  if (canBookingCloseAction(booking)) {
    optional.push('close');
  }
  if (bookingCardPrintInMain(booking)) {
    optional.push('print');
  }

  for (const id of optional) {
    if (main.length >= BOOKING_CARD_MAIN_ACTION_LIMIT) {
      break;
    }
    main.push(id);
  }

  return main;
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

/** إظهار قائمة ⋯ فقط عند وجود إجراء واحد على الأقل. */
export function bookingCardMoreMenuVisible(booking: Booking): boolean {
  return (
    canBookingSuspendAction(booking) ||
    canBookingEditAction(booking) ||
    canBookingExtendAction(booking) ||
    bookingCardPrintInMenu(booking) ||
    bookingCardCloseInMenu(booking) ||
    bookingCardFinishInMenu(booking)
  );
}
