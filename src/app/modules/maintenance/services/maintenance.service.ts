import { Injectable, inject } from '@angular/core';
import { Observable, map, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../core/interfaces';
import { BaseService } from '../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../shared/utils/paginated-response.normalizer';
import {
  Maintenance,
  MaintenanceAcceptRequest,
  MaintenanceByBookingSummary,
  MaintenanceFilters,
  MaintenanceFinishRequest,
  MaintenanceUpsertRequest,
} from '../models/maintenance.model';
import {
  normalizeMaintenance,
  normalizeMaintenanceByBookingSummary,
  resolveMaintenanceIdFromCreateResponse,
} from '../models/maintenance.normalizer';

/**
 * Matches `MaintenanceRouting`:
 * - List, Paginated, GetById `/{id}/{fleetid}`, Create, Update `/{id}`,
 * - SoftDelete `/SoftDelete/{id}/{fleetid}`,
 * - Acceptable `PUT /Acceptable/{id}`,
 * - Finsh `PUT /Finsh/{id}`.
 */
@Injectable({
  providedIn: 'root',
})
export class MaintenanceService {
  private api = inject(BaseService);
  private readonly base = 'Maintenance';

  getList(params: { fleetId?: string | null; branchId?: number | null } = {}): Observable<Maintenance[]> {
    const branchId = params.branchId && params.branchId > 0 ? params.branchId : undefined;
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(params.fleetId, 'both'),
          Fleetid: normalizeFleetId(params.fleetId) ?? undefined,
          Branchid: branchId,
          branchid: branchId,
        },
        { suppressErrorToast: true },
      )
      .pipe(map(items => (items ?? []).map(normalizeMaintenance)));
  }

  getPaginated(params: MaintenanceFilters): Observable<PaginatedAggregatorResponse<Maintenance>> {
    const orderBy = params.orderBy ?? 'CreatedAt';
    const direction = params.orderByDirection ?? 'DESC';
    const branchId = params.branchId && params.branchId > 0 ? params.branchId : 0;
    const status = params.status?.trim() || undefined;

    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        ...buildFleetQueryParams(params.fleetId, 'both'),
        Fleetid: normalizeFleetId(params.fleetId) ?? undefined,
        BranchId: branchId,
        branchId,
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        Search: params.search,
        search: params.search,
        Stutus: status,
        stutus: status,
        OrderBy: orderBy,
        orderBy,
        OrderByDirection: direction,
        orderByDirection: direction,
      })
      .pipe(map(response => normalizePaginatedResponse(response, normalizeMaintenance)));
  }

  getById(id: string, fleetId?: string | null): Observable<Maintenance> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    const encodedId = encodeURIComponent(String(id));
    const encodedFleet = encodeURIComponent(fid);
    return this.api
      .getData<unknown>(`${this.base}/${encodedId}/${encodedFleet}`)
      .pipe(map(raw => normalizeMaintenance(raw)));
  }

  /**
   * `GET Maintenance/GetTotal/{idbooking}/{fleetid}` — maintenance linked to a booking (accident flow).
   */
  getTotalByBooking(idBooking: number, fleetId: string): Observable<MaintenanceByBookingSummary | null> {
    const fid = normalizeFleetId(fleetId);
    if (!fid || !Number.isFinite(idBooking) || idBooking <= 0) {
      return throwError(() => new Error('FleetId and booking id are required'));
    }
    const encodedBooking = encodeURIComponent(String(idBooking));
    const encodedFleet = encodeURIComponent(fid);
    return this.api
      .getData<unknown>(`${this.base}/GetTotal/${encodedBooking}/${encodedFleet}`, undefined, {
        suppressErrorToast: true,
      })
      .pipe(map(raw => (raw == null ? null : normalizeMaintenanceByBookingSummary(raw))));
  }

  create(body: MaintenanceUpsertRequest): Observable<Maintenance> {
    return this.api.postData<unknown>(this.base, this.toCommandPayload(body)).pipe(
      map(raw => {
        const id = resolveMaintenanceIdFromCreateResponse(raw);
        const seed: Record<string, unknown> = {
          idVehicle: body.idVehicle,
          IdVehicle: body.idVehicle,
          fleetId: body.fleetId,
          FleetId: body.fleetId,
        };
        if (id) {
          seed['id'] = id;
          seed['Id'] = id;
        }
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          return normalizeMaintenance({ ...(raw as Record<string, unknown>), ...seed });
        }
        return normalizeMaintenance(seed);
      }),
    );
  }

  update(body: MaintenanceUpsertRequest): Observable<unknown> {
    const id = body.id;
    if (!id) {
      return throwError(() => new Error('Id is required for update'));
    }
    return this.api.putData(`${this.base}/${encodeURIComponent(id)}`, this.toCommandPayload(body));
  }

  /**
   * `PUT Maintenance/Acceptable/{id}` — `MaintenanceRouting.Acceptable`.
   * Sets start date, duration, and moves status to InProgress.
   */
  acceptable(body: MaintenanceAcceptRequest): Observable<unknown> {
    const id = encodeURIComponent(String(body.id));
    const payload = this.toAcceptablePayload(body);
    return this.api.putData(`${this.base}/Acceptable/${id}`, payload);
  }

  /**
   * `PUT Maintenance/Finsh/{id}` — sets end date, total, and status to Completed.
   */
  finish(body: MaintenanceFinishRequest): Observable<unknown> {
    const id = encodeURIComponent(String(body.id));
    const payload = this.toFinishPayload(body);
    return this.api.putData(`${this.base}/Finsh/${id}`, payload);
  }

  /** `PATCH Maintenance/SoftDelete/{id}/{fleetid}` — `MaintenanceRouting.SoftDelete`. */
  softDelete(id: string | number, fleetId: string): Observable<unknown> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    const encodedId = encodeURIComponent(String(id));
    const encodedFleet = encodeURIComponent(fid);
    return this.api.patchData(`${this.base}/SoftDelete/${encodedId}/${encodedFleet}`, {});
  }

  /**
   * Minimal payload: fleet + vehicle (required), optional booking + insurance,
   * and a note. No branch/dates/odometer/compensation/image/parts are sent.
   */
  private toCommandPayload(body: MaintenanceUpsertRequest): Record<string, unknown> {
    const idNum = body.id ? Number(body.id) : undefined;
    const note = body.note?.trim() || null;
    return {
      Id: idNum,
      id: idNum,
      FleetId: body.fleetId,
      fleetId: body.fleetId,
      IdVehicle: body.idVehicle,
      idVehicle: body.idVehicle,
      IdBooking: this.normalizeOptionalLong(body.idBooking),
      idBooking: this.normalizeOptionalLong(body.idBooking),
      IdInsurancecompanies: this.normalizeOptionalLong(body.idInsurancecompanies),
      idInsurancecompanies: this.normalizeOptionalLong(body.idInsurancecompanies),
      Note: note,
      note,
    };
  }

  private toAcceptablePayload(body: MaintenanceAcceptRequest): Record<string, unknown> {
    const idNum = Number(body.id);
    const fleetId = body.fleetId;
    const start = body.startDate?.trim();
    const duration = body.durationMaintenance?.trim() || null;
    const end = body.endDate?.trim() || null;
    return {
      Id: idNum,
      id: idNum,
      IdFleet: fleetId,
      idFleet: fleetId,
      FleetId: fleetId,
      fleetId,
      StartDate: start,
      startDate: start,
      EndDate: end,
      endDate: end,
      Durationmaintanance: duration,
      durationmaintanance: duration,
      DurationMaintenance: duration,
      durationMaintenance: duration,
    };
  }

  private toFinishPayload(body: MaintenanceFinishRequest): Record<string, unknown> {
    const idNum = Number(body.id);
    const fleetId = body.fleetId;
    const end = body.endDate?.trim();
    const total = Number(body.total) || 0;
    return {
      Id: idNum,
      id: idNum,
      IdFleet: fleetId,
      idFleet: fleetId,
      FleetId: fleetId,
      fleetId,
      EndDate: end,
      endDate: end,
      Total: total,
      total,
    };
  }

  private normalizeOptionalLong(value: number | null | undefined): number | null {
    if (value === null || value === undefined) {
      return null;
    }
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
