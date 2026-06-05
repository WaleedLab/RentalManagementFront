import { Injectable } from '@angular/core';

import { BookingTrackingRouteParams } from '../../utils/booking-tracking-params.util';
import {
  TrackingFilterForm,
  TrackingWorkspaceContext,
} from '../../models/tracking/tracking.model';

@Injectable({ providedIn: 'root' })
export class BookingTrackingService {
  buildContext(
    bookingId: string,
    fleetId: string,
    params: BookingTrackingRouteParams,
  ): TrackingWorkspaceContext {
    const initialFilters: TrackingFilterForm = {
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      trackingUrl: '',
    };

    const vehicleInfo = {
      plateNumber: params.plate?.trim() || '—',
      vehicleLabel: params.vehicleLabel?.trim() || '—',
      branchName: params.branchName,
      serialNumber: params.vehicleSerialNumber?.trim() || undefined,
      extraLines: [
        { labelKey: 'Customer', value: params.customerName?.trim() || '—' },
        { labelKey: 'Contract Number', value: params.contractNumber?.trim() || '—' },
        { labelKey: 'Status', value: params.bookingStatus?.trim() || '—' },
      ],
    };

    return {
      mode: 'booking',
      entityId: bookingId,
      fleetId,
      title: '',
      subtitle: '',
      backLink: ['/booking'],
      detailsLink: ['/booking', 'details', bookingId],
      trackingVehicleId: params.vehicleId,
      initialFilters,
      vehicleInfo,
    };
  }
}
