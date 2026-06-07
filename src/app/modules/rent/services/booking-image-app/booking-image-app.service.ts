import { Injectable, inject } from '@angular/core';

import { Observable, catchError, map, of } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import { BookingImageApp } from '../../models/booking-image-app/booking-image-app.model';
import { normalizeBookingImageApp } from '../../models/booking-image-app/booking-image-app.normalizer';

@Injectable({
  providedIn: 'root',
})
export class BookingImageAppService {
  private api = inject(BaseService);
  private readonly base = 'BookingImageApp';

  /**
   * `GetBookingImageAppByIdBookingsQuery` → `GET BookingImageApp/List?IdFleet=&BookingId=`.
   */
  getByBooking(bookingId: number, fleetId?: string | null): Observable<BookingImageApp[]> {
    const fleet = normalizeFleetId(fleetId);
    if (!fleet || !Number.isFinite(bookingId) || bookingId <= 0) {
      return of([]);
    }
    return this.api
      .getData<unknown[]>(`${this.base}/List`, {
        IdFleet: fleet,
        idFleet: fleet,
        BookingId: bookingId,
        bookingId: bookingId,
      }, { suppressErrorToast: true })
      .pipe(
        map(items => (Array.isArray(items) ? items : []).map(normalizeBookingImageApp)),
        catchError(() => of([])),
      );
  }
}
