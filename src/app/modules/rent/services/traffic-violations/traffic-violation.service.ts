import { Injectable, inject } from '@angular/core';

import { Observable, map, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import {
  TrafficViolation,
  TrafficViolationFilters,
  TrafficViolationUpsertRequest,
} from '../../models/traffic-violations/traffic-violation.model';
import { normalizeTrafficViolation } from '../../models/traffic-violations/traffic-violation.normalizer';

@Injectable({
  providedIn: 'root',
})
export class TrafficViolationService {
  private api = inject(BaseService);
  private readonly base = 'TrafficViolation';

  /** `GET TrafficViolation/List` — `GetTrafficViolationsQuery` (fleet only). */
  getList(fleetId?: string | null): Observable<TrafficViolation[]> {
    return this.api
      .getData<unknown[]>(`${this.base}/List`, {
        ...buildFleetQueryParams(fleetId, 'both'),
      })
      .pipe(map(items => (items ?? []).map(normalizeTrafficViolation)));
  }

  getPaginated(params: TrafficViolationFilters): Observable<PaginatedAggregatorResponse<TrafficViolation>> {
    const orderBy = params.orderBy ?? 0;
    const direction = params.orderByDirection ?? 'DESC';
    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        ...buildFleetQueryParams(params.fleetId, 'both'),
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        Search: params.search,
        search: params.search,
        OrderBy: orderBy,
        orderBy: orderBy,
        OrderByDirection: direction,
        orderByDirection: direction,
      })
      .pipe(map(response => normalizePaginatedResponse(response, normalizeTrafficViolation)));
  }

  /**
   * `GET TrafficViolation/{id}/{fleetid}` — matches `TrafficViolationRouting.GetById`.
   */
  getById(id: string, fleetId?: string | null): Observable<TrafficViolation> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    const encodedId = encodeURIComponent(String(id));
    const encodedFleet = encodeURIComponent(fid);
    return this.api
      .getData<unknown>(`${this.base}/${encodedId}/${encodedFleet}`)
      .pipe(map(raw => normalizeTrafficViolation(raw)));
  }

  /** `POST TrafficViolation` — `TrafficViolationRouting.Create` */
  create(body: TrafficViolationUpsertRequest): Observable<unknown> {
    return this.api.postData(this.base, this.toCommandPayload(body));
  }

  /**
   * `PUT TrafficViolation/{id}` — matches typical `Update = Prefix + SingleRoute` (`/{id}`).
   * If your `SingleRoute` is empty (PUT same URL as create), change this to `putData(this.base, …)`.
   */
  update(body: TrafficViolationUpsertRequest): Observable<unknown> {
    const id = body.id;
    if (!id) {
      return throwError(() => new Error('Id is required for update'));
    }
    return this.api.putData(`${this.base}/${encodeURIComponent(id)}`, this.toCommandPayload(body));
  }

  /**
   * `PATCH TrafficViolation/SoftDelete/{id}` — matches `TrafficViolationRouting.SoftDelete`
   * (same pattern as `VehicleService.softDelete` / `CustomerService.softDelete`).
   */
  softDelete(id: string | number, _fleetId: string): Observable<unknown> {
    const encodedId = encodeURIComponent(String(id));
    return this.api.patchData(`${this.base}/SoftDelete/${encodedId}`, {});
  }

  private toCommandPayload(body: TrafficViolationUpsertRequest): Record<string, unknown> {
    const fleet = body.fleetId;
    const idNum = body.id ? Number(body.id) : undefined;
    return {
      Id: idNum,
      id: idNum,
      NameViolation: body.nameViolation,
      nameViolation: body.nameViolation,
      IdBooking: this.normalizeOptionalBookingId(body.idBooking),
      idBooking: this.normalizeOptionalBookingId(body.idBooking),
      IdVehicle: body.idVehicle,
      idVehicle: body.idVehicle,
      DateViolation: body.dateViolation,
      dateViolation: body.dateViolation,
      ViolationFine: body.violationFine,
      violationFine: body.violationFine,
      Description: body.description,
      description: body.description,
      NumberViolation: body.numberViolation,
      numberViolation: body.numberViolation,
      FleetId: fleet,
      fleetId: fleet,
    };
  }

  /** Backend `long? IdBooking` — send JSON `null` when there is no booking. */
  private normalizeOptionalBookingId(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
