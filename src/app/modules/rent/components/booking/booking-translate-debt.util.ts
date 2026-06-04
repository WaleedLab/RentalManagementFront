import { HttpErrorResponse } from '@angular/common/http';
import { extractApiErrorBodyMessage, normalizeApiError } from '../../../../core/api/api-response.utils';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import { Booking } from '../../models';
import { BookingService } from '../../services/booking/booking.service';

export function canBookingTranslateToDebtAction(
  booking: Pick<Booking, 'status'> | null | undefined,
): boolean {
  const s = String(booking?.status ?? '').trim();
  /** تعليق مالي: معلّق ذمم / دفعة على الحساب — قبل تحويل الحالة إلى `translate`. */
  return s === 'Suspended_due_to_sum_money' || s === 'Payment_on_account';
}

export function runBookingTranslateToDebt(options: {
  booking: Booking;
  fleetId: string | null | undefined;
  bookingService: BookingService;
  confirmService: ConfirmService;
  toast: ToastService;
  translate: (key: string) => string;
  onSuccess: () => void;
}): void {
  const { booking, bookingService, confirmService, toast, translate, onSuccess } = options;
  if (!canBookingTranslateToDebtAction(booking)) {
    return;
  }

  const fleetId = normalizeFleetId(options.fleetId ?? booking.fleetId);
  if (!fleetId) {
    toast.error(translate('Booking fleet required for action'));
    return;
  }

  const bookingId = Number(booking.id);
  if (!Number.isFinite(bookingId) || bookingId <= 0) {
    toast.error(translate('Booking translate to debt failed'));
    return;
  }

  confirmService
    .confirm(
      translate('Booking translate to debt confirm title'),
      translate('Booking translate to debt confirm body'),
    )
    .subscribe(confirmed => {
      if (!confirmed) {
        return;
      }

      bookingService.translateToDebt({ id: bookingId, fleetId }).subscribe({
        next: () => {
          toast.success(translate('Booking translate to debt success'));
          onSuccess();
        },
        error: err => {
          toast.error(translateToDebtErrorMessage(err, translate));
        },
      });
    });
}

function translateToDebtErrorMessage(err: unknown, translate: (key: string) => string): string {
  if (err instanceof HttpErrorResponse) {
    const fromBody = extractApiErrorBodyMessage(err.error);
    if (fromBody) {
      return fromBody;
    }
    const normalized = normalizeApiError(err);
    if (
      normalized.message &&
      normalized.message !== 'Unexpected error' &&
      !normalized.message.startsWith('Http failure response')
    ) {
      return normalized.message;
    }
    if (err.status === 404) {
      return translate('Booking translate to debt failed');
    }
  }
  if (err instanceof Error) {
    const msg = err.message.trim();
    if (msg && !msg.startsWith('Http failure response')) {
      const stripped = msg.replace(/^Booking\/[^:]+:\s*/i, '').trim();
      return stripped || msg;
    }
  }
  return translate('Booking translate to debt failed');
}
