import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, switchMap, throwError } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { environment } from '../../../../../environments/environment';
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
import { isTrackingNoDataError, parseTrackingApiBody } from '../../utils/tracking-api.utils';
import { resolveTrackingIdVehicle } from '../../utils/tracking-id.utils';
import { isValidTrackingUrl } from '../../utils/tracking-url.utils';
import {
  normalizeTrackingFilterRange,
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
  serialNumber?: string,
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
    serialNumber: serialNumber?.trim() || undefined,
    status: 'Available' as VehicleStatus,
    isActive: true,
  };
}

function buildTrackingQueryParams(
  vehicleDbId: string,
  filters: TrackingFilterForm,
): Record<string, string | number | boolean | undefined> {
  const idVehicle = resolveTrackingIdVehicle(vehicleDbId);
  const normalizedRange = normalizeTrackingFilterRange(filters.dateFrom, filters.dateTo);

  if (!normalizedRange) {
    throw new Error('Tracking date range is required');
  }

  const begin = toTrackingBeginDateTime(normalizedRange.dateFrom);
  const end = toTrackingEndDateTime(normalizedRange.dateTo);

  const params = {
    IdVehicle: idVehicle,
    begindate: begin,
    lastdate: end,
  };

  if (!environment.production) {
    // eslint-disable-next-line no-console
    console.info('[Tracking/GetApi] query params', params);
  }

  return params;
}

@Injectable({ providedIn: 'root' })
export class VehicleTrackingService {
  private readonly api = inject(BaseService);
  private readonly vehicleService = inject(VehicleService);
  /**
   * Router.TrackingRouting.GetApi → Api/V1/CarRentalManagament/Tracking/GetApi
   * Query: IdVehicle (int64 vehicle DB id), begindate, lastdate (`yyyy-MM-dd HH:mm:ss`).
   * Response may be `text/plain` map URL or `Result<string>`.
   */
  private readonly trackingEndpoint = 'Tracking/GetApi';

  createDefaultFilters(): TrackingFilterForm {
    const end = new Date();
    const start = new Date(end);
    start.setDate(end.getDate() - 29);
    return {
      dateFrom: toTrackingDateOnlyInput(start),
      dateTo: toTrackingDateOnlyInput(end),
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
          detailsLink: ['/vehicles', 'details', vehicle.id],
          vehicleInfo: {
            plateNumber: vehicle.plateNumber || '—',
            vehicleLabel,
            branchName: vehicle.branchName,
            serialNumber: vehicle.serialNumber?.trim() || undefined,
          },
          initialFilters: this.createDefaultFilters(),
        };
      }),
    );
  }

  loadWorkspace(request: TrackingWorkspaceRequest): Observable<TrackingWorkspaceSession> {
    const fleetId = request.fleetId.trim();
    const pastedUrl = request.filters.trackingUrl.trim();

    const serialHint = (request.trackingSerialNumber ?? '').trim();
    const vehicle$ =
      request.vehicleStub && serialHint
        ? of(vehicleFromStub(request.vehicleId, fleetId, request.vehicleStub, serialHint))
        : this.vehicleService.getById(request.vehicleId, fleetId);

    return vehicle$.pipe(
      catchError(err =>
        throwError(() =>
          err instanceof Error ? err : new Error('Failed to load vehicle for tracking'),
        ),
      ),
      switchMap(vehicle => {
        const vehicleCtx = { ...vehicle, fleetId };

        if (pastedUrl && isValidTrackingUrl(pastedUrl)) {
          return of(buildEmptyWorkspaceSession(vehicleCtx, request.filters, pastedUrl));
        }

        let params: Record<string, string | number | boolean | undefined>;
        try {
          params = buildTrackingQueryParams(String(vehicle.id), request.filters);
        } catch (validationError) {
          return throwError(() =>
            validationError instanceof Error ? validationError : new Error('Tracking date range is required'),
          );
        }

        return this.api.getText(this.trackingEndpoint, params, { suppressErrorToast: true }).pipe(
          map(body => parseTrackingApiBody(body)),
          map(raw => buildTrackingWorkspaceSessionFromApi(raw, vehicleCtx, fleetId, request.filters)),
          catchError(err => {
            if (isTrackingNoDataError(err)) {
              return of(
                buildEmptyWorkspaceSession(vehicleCtx, request.filters, undefined, {
                  statusMessage: 'No data found',
                }),
              );
            }
            if (err instanceof HttpErrorResponse && !environment.production) {
              // eslint-disable-next-line no-console
              console.error(
                '[Tracking/GetApi] HTTP error',
                err.status,
                typeof err.error === 'string' ? err.error : err.error,
              );
            }
            return throwError(() => err);
          }),
        );
      }),
    );
  }
}
