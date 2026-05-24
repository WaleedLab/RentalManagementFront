import { Injectable, inject } from '@angular/core';
import { Observable, map, switchMap } from 'rxjs';

import {
  TrackingFilterForm,
  TrackingVehicleInfo,
  TrackingWorkspaceContext,
  TrackingWorkspaceRequest,
  TrackingWorkspaceSession,
} from '../../models/tracking/tracking.model';
import { BookingService } from '../booking/booking.service';
import { VehicleTrackingService } from './vehicle-tracking.service';
import { formatTrackingVehicleCaption } from '../../utils/tracking-display.utils';

@Injectable({ providedIn: 'root' })
export class BookingTrackingService {
  private readonly bookingService = inject(BookingService);
  private readonly vehicleTrackingService = inject(VehicleTrackingService);

  loadContext(bookingId: string, fleetId: string): Observable<TrackingWorkspaceContext> {
    return this.bookingService.getById(bookingId, fleetId).pipe(
      map(booking => {
        const vehicleInfo: TrackingVehicleInfo = {
          plateNumber: booking.vehiclePlateNumber || '—',
          vehicleLabel: booking.vehicleName || booking.vehicleCategoryLabel || '—',
          branchName: booking.branchName,
          extraLines: [
            { labelKey: 'Customer', value: booking.customerName || '—' },
            { labelKey: 'Contract Number', value: booking.numberBookingINBasame || booking.bookingNumber || '—' },
            { labelKey: 'Status', value: booking.statusDisplayName || booking.status },
          ],
        };

        return {
          mode: 'booking' as const,
          entityId: booking.id,
          fleetId,
          title: booking.numberBookingINBasame || booking.bookingNumber || booking.id,
          subtitle: formatTrackingVehicleCaption(vehicleInfo.plateNumber, vehicleInfo.vehicleLabel),
          backLink: ['/booking'],
          detailsLink: ['/booking', booking.id, 'details'],
          vehicleInfo,
        };
      }),
    );
  }

  loadWorkspace(
    bookingId: string,
    fleetId: string,
    filters: TrackingFilterForm,
  ): Observable<TrackingWorkspaceSession> {
    return this.bookingService.getById(bookingId, fleetId).pipe(
      switchMap(booking => {
        const request: TrackingWorkspaceRequest = {
          fleetId,
          vehicleId: booking.vehicleId,
          bookingId,
          filters,
        };
        return this.vehicleTrackingService.loadWorkspace(request).pipe(
          map(session => ({
            ...session,
            vehicleInfo: {
              ...session.vehicleInfo,
              extraLines: [
                { labelKey: 'Customer', value: booking.customerName || '—' },
                { labelKey: 'Contract Number', value: booking.numberBookingINBasame || booking.bookingNumber || '—' },
                { labelKey: 'Status', value: booking.statusDisplayName || booking.status },
              ],
            },
          })),
        );
      }),
    );
  }
}
