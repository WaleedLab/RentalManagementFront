import { ParamMap } from '@angular/router';

import { Booking } from '../models/booking/booking.model';
import { TrackingFilterForm } from '../models/tracking/tracking.model';
import { toTrackingDateOnlyInput } from './tracking-date.utils';

/** Route/query payload for booking tracking (no Booking GET). */
export interface BookingTrackingRouteParams {
  vehicleId: string;
  dateFrom: string;
  dateTo: string;
  plate?: string;
  vehicleLabel?: string;
  branchName?: string;
  customerName?: string;
  contractNumber?: string;
  bookingStatus?: string;
}

/** Exit = pickup when set, else contract start; end = expected return (`endDate`). */
export function resolveBookingTrackingDateRange(
  booking: Pick<Booking, 'startDate' | 'pickupDate' | 'endDate'>,
): Pick<TrackingFilterForm, 'dateFrom' | 'dateTo'> {
  const exitRaw = String(booking.pickupDate ?? booking.startDate ?? '').trim();
  const returnRaw = String(booking.endDate ?? '').trim();
  return {
    dateFrom: toTrackingDateOnlyInput(exitRaw),
    dateTo: toTrackingDateOnlyInput(returnRaw),
  };
}

export function buildBookingTrackingQueryParams(booking: Booking): Record<string, string> {
  const { dateFrom, dateTo } = resolveBookingTrackingDateRange(booking);
  const params: Record<string, string> = {
    vehicleId: String(booking.vehicleId ?? '').trim(),
    dateFrom,
    dateTo,
  };

  const plate = String(booking.vehiclePlateNumber ?? '').trim();
  if (plate) {
    params['plate'] = plate;
  }

  const vehicleLabel =
    String(booking.vehicleName ?? booking.vehicleCategoryLabel ?? '').trim();
  if (vehicleLabel) {
    params['vehicleLabel'] = vehicleLabel;
  }

  const branchName = String(booking.branchName ?? '').trim();
  if (branchName) {
    params['branchName'] = branchName;
  }

  const customerName = String(booking.customerName ?? '').trim();
  if (customerName) {
    params['customerName'] = customerName;
  }

  const contractNumber = String(
    booking.numberBookingINBasame ?? booking.bookingNumber ?? '',
  ).trim();
  if (contractNumber) {
    params['contractNumber'] = contractNumber;
  }

  const bookingStatus = String(booking.statusDisplayName ?? booking.status ?? '').trim();
  if (bookingStatus) {
    params['bookingStatus'] = bookingStatus;
  }

  return params;
}

function pickQueryOrState(
  query: ParamMap,
  state: Partial<BookingTrackingRouteParams> | null | undefined,
  key: keyof BookingTrackingRouteParams,
): string {
  return String(query.get(key) ?? state?.[key] ?? '').trim();
}

export function parseBookingTrackingRouteParams(
  query: ParamMap,
  state: unknown,
): BookingTrackingRouteParams | null {
  const fromState =
    state && typeof state === 'object' ? (state as Partial<BookingTrackingRouteParams>) : null;

  const vehicleId = pickQueryOrState(query, fromState, 'vehicleId');
  const dateFrom = pickQueryOrState(query, fromState, 'dateFrom');
  const dateTo = pickQueryOrState(query, fromState, 'dateTo');

  if (!vehicleId || !dateFrom || !dateTo) {
    return null;
  }

  return {
    vehicleId,
    dateFrom,
    dateTo,
    plate: pickQueryOrState(query, fromState, 'plate') || undefined,
    vehicleLabel: pickQueryOrState(query, fromState, 'vehicleLabel') || undefined,
    branchName: pickQueryOrState(query, fromState, 'branchName') || undefined,
    customerName: pickQueryOrState(query, fromState, 'customerName') || undefined,
    contractNumber: pickQueryOrState(query, fromState, 'contractNumber') || undefined,
    bookingStatus: pickQueryOrState(query, fromState, 'bookingStatus') || undefined,
  };
}
