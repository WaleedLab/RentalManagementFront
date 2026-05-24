import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams } from '../../../../shared/utils/fleet-query.utils';
import {
  TrackingFilterForm,
  TrackingWorkspaceContext,
  TrackingWorkspaceRequest,
  TrackingWorkspaceSession,
} from '../../models/tracking/tracking.model';
import {
  buildEmptyWorkspaceSession,
  buildTrackingWorkspaceSession,
} from '../../models/tracking/tracking.normalizer';
import { isValidTrackingUrl } from '../../utils/tracking-url.utils';
import { formatTrackingVehicleCaption } from '../../utils/tracking-display.utils';
import { VehicleService } from '../vehicles/vehicle.service';

function toDateOnlyInput(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

@Injectable({ providedIn: 'root' })
export class VehicleTrackingService {
  private readonly api = inject(BaseService);
  private readonly vehicleService = inject(VehicleService);
  private readonly resource = 'Vehicle';

  createDefaultFilters(): TrackingFilterForm {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return {
      dateFrom: toDateOnlyInput(start.toISOString()),
      dateTo: toDateOnlyInput(end.toISOString()),
      trackingUrl: '',
    };
  }

  loadContext(vehicleId: string, fleetId: string): Observable<TrackingWorkspaceContext> {
    return this.vehicleService.getById(vehicleId, fleetId).pipe(
      map(vehicle => {
        const vehicleLabel =
          [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' ').trim() || vehicle.plateNumber;
        return {
          mode: 'vehicle' as const,
          entityId: vehicle.id,
          fleetId,
          title: vehicle.plateNumber || vehicleLabel,
          subtitle: formatTrackingVehicleCaption(vehicle.plateNumber, vehicleLabel),
          backLink: ['/vehicles'],
          detailsLink: ['/vehicles', vehicle.id, 'details'],
          vehicleInfo: {
            plateNumber: vehicle.plateNumber || '—',
            vehicleLabel,
            branchName: vehicle.branchName,
          },
        };
      }),
    );
  }

  loadWorkspace(request: TrackingWorkspaceRequest): Observable<TrackingWorkspaceSession> {
    const fleetId = request.fleetId.trim();
    const pastedUrl = request.filters.trackingUrl.trim();

    return this.vehicleService.getById(request.vehicleId, fleetId).pipe(
      switchMap(vehicle => {
        if (pastedUrl && isValidTrackingUrl(pastedUrl)) {
          return of(buildEmptyWorkspaceSession({ ...vehicle, fleetId }, request.filters, pastedUrl));
        }

        return this.api
          .getData<unknown>(
            `${this.resource}/${request.vehicleId}/Tracking/${fleetId}`,
            {
              ...buildFleetQueryParams(fleetId, 'both'),
              DateFrom: request.filters.dateFrom || undefined,
              DateTo: request.filters.dateTo || undefined,
              dateFrom: request.filters.dateFrom || undefined,
              dateTo: request.filters.dateTo || undefined,
            },
            { suppressErrorToast: true },
          )
          .pipe(
            map(raw => buildTrackingWorkspaceSession(raw, { ...vehicle, fleetId }, request.filters)),
            catchError(() => of(buildEmptyWorkspaceSession({ ...vehicle, fleetId }, request.filters))),
          );
      }),
    );
  }
}
