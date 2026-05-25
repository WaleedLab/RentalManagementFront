import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';

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
  buildTrackingWorkspaceSessionFromApi,
} from '../../models/tracking/tracking.normalizer';
import { isValidTrackingUrl } from '../../utils/tracking-url.utils';
import {
  toTrackingBeginDateTime,
  toTrackingDateOnlyInput,
  toTrackingEndDateTime,
} from '../../utils/tracking-date.utils';
import { VehicleService } from '../vehicles/vehicle.service';
import { Vehicle, VehicleStatus } from '../../models/vehicles/vehicle.model';

function vehicleFromStub(
  vehicleId: string,
  fleetId: string,
  stub: NonNullable<TrackingWorkspaceRequest['vehicleStub']>,
): Vehicle {
  const label = stub.vehicleLabel?.trim() || stub.plateNumber?.trim() || '—';
  return {
    id: vehicleId,
    fleetId,
    plateNumber: stub.plateNumber?.trim() || '—',
    make: '',
    model: label,
    year: 0,
    branchName: stub.branchName,
    status: 'Available' as VehicleStatus,
    isActive: true,
  };
}

function buildTrackingQueryParams(
  vehicleId: string,
  fleetId: string,
  filters: TrackingFilterForm,
): Record<string, string | number | boolean | undefined> {
  const idVehicle = Number(vehicleId);
  const begin = toTrackingBeginDateTime(filters.dateFrom);
  const end = toTrackingEndDateTime(filters.dateTo);

  return {
    ...buildFleetQueryParams(fleetId, 'both'),
    IdVehicle: Number.isFinite(idVehicle) ? idVehicle : vehicleId,
    begindate: begin,
    lastdate: end,
    DateFrom: filters.dateFrom || undefined,
    DateTo: filters.dateTo || undefined,
    dateFrom: filters.dateFrom || undefined,
    dateTo: filters.dateTo || undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class VehicleTrackingService {
  private readonly api = inject(BaseService);
  private readonly vehicleService = inject(VehicleService);
  /** Router.TrackingRouting.GetApi → Api/V1/CarRentalManagament/Tracking/GetApi */
  private readonly trackingEndpoint = 'Tracking/GetApi';

  createDefaultFilters(): TrackingFilterForm {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    return {
      dateFrom: toTrackingDateOnlyInput(start.toISOString()),
      dateTo: toTrackingDateOnlyInput(end.toISOString()),
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
          title: '',
          subtitle: '',
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

    const vehicle$ = request.vehicleStub
      ? of(vehicleFromStub(request.vehicleId, fleetId, request.vehicleStub))
      : this.vehicleService.getById(request.vehicleId, fleetId);

    return vehicle$.pipe(
      switchMap(vehicle => {
        const vehicleCtx = { ...vehicle, fleetId };

        if (pastedUrl && isValidTrackingUrl(pastedUrl)) {
          return of(buildEmptyWorkspaceSession(vehicleCtx, request.filters, pastedUrl));
        }

        return this.api
          .getData<string>(
            this.trackingEndpoint,
            buildTrackingQueryParams(request.vehicleId, fleetId, request.filters),
            { suppressErrorToast: true },
          )
          .pipe(
            map(raw => buildTrackingWorkspaceSessionFromApi(raw, vehicleCtx, fleetId, request.filters)),
            catchError(err =>
              throwError(() => (err instanceof Error ? err : new Error('Tracking load failed'))),
            ),
          );
      }),
    );
  }
}
