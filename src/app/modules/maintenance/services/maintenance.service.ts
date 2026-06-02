import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap, throwError } from 'rxjs';

import { buildImageUploadPayload } from '../../../shared/utils/image-upload.utils';

import { PaginatedAggregatorResponse } from '../../../core/interfaces';
import { BaseService } from '../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../shared/utils/paginated-response.normalizer';
import {
  Maintenance,
  MaintenanceFilters,
  MaintenanceUpsertRequest,
} from '../models/maintenance.model';
import { normalizeMaintenance } from '../models/maintenance.normalizer';

/**
 * Matches `MaintenanceRouting`:
 * - List, Paginated, GetById `/{id}/{fleetid}`, Create, Update `/{id}`,
 * - SoftDelete `/SoftDelete/{id}/{fleetid}`.
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
    const orderBy = params.orderBy ?? 0;
    const direction = params.orderByDirection ?? 'DESC';
    const branchId = params.branchId && params.branchId > 0 ? params.branchId : 0;

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

  create(body: MaintenanceUpsertRequest): Observable<unknown> {
    return from(this.toCommandPayload(body)).pipe(
      switchMap(payload => this.api.postData(this.base, payload)),
    );
  }

  update(body: MaintenanceUpsertRequest): Observable<unknown> {
    const id = body.id;
    if (!id) {
      return throwError(() => new Error('Id is required for update'));
    }
    return from(this.toCommandPayload(body)).pipe(
      switchMap(payload => this.api.putData(`${this.base}/${encodeURIComponent(id)}`, payload)),
    );
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

  private async toCommandPayload(body: MaintenanceUpsertRequest): Promise<Record<string, unknown>> {
    const imagePayload = await buildImageUploadPayload(body.image);
    const url =
      imagePayload?.attachment?.trim() ||
      body.existingUrl?.trim() ||
      null;

    const idNum = body.id ? Number(body.id) : undefined;
    return {
      Id: idNum,
      id: idNum,
      IdBranch: body.idBranch,
      idBranch: body.idBranch,
      IdVehicle: body.idVehicle,
      idVehicle: body.idVehicle,
      IdBooking: this.normalizeOptionalLong(body.idBooking),
      idBooking: this.normalizeOptionalLong(body.idBooking),
      IdInsurancecompanies: this.normalizeOptionalLong(body.idInsurancecompanies),
      idInsurancecompanies: this.normalizeOptionalLong(body.idInsurancecompanies),
      IdSupplier: this.normalizeOptionalLong(body.idSupplier),
      idSupplier: this.normalizeOptionalLong(body.idSupplier),
      IdSupplieres: this.normalizeOptionalLong(body.idSupplier),
      idSupplieres: this.normalizeOptionalLong(body.idSupplier),
      FleetId: body.fleetId,
      fleetId: body.fleetId,
      StartDate: body.startDate,
      startDate: body.startDate,
      EndDate: body.endDate ?? null,
      endDate: body.endDate ?? null,
      StartTime: body.startTime ?? null,
      startTime: body.startTime ?? null,
      EndTime: body.endTime ?? null,
      endTime: body.endTime ?? null,
      OdometerIn: body.odometerIn ?? null,
      odometerIn: body.odometerIn ?? null,
      OdometerOut: body.odometerOut ?? null,
      odometerOut: body.odometerOut ?? null,
      DurationMaintenance: body.durationMaintenance ?? null,
      durationMaintenance: body.durationMaintenance ?? null,
      TypeCompensation: body.typeCompensation ?? null,
      typeCompensation: body.typeCompensation ?? null,
      Note: body.note ?? null,
      note: body.note ?? null,
      ValueCompensation: body.valueCompensation,
      valueCompensation: body.valueCompensation,
      Total: body.total ?? null,
      total: body.total ?? null,
      Url: url,
      url,
      SpareParts: (body.spareParts ?? []).map(x => ({
        IdSparePartName: x.idSparePartName,
        idSparePartName: x.idSparePartName,
        Quantity: x.quantity,
        quantity: x.quantity,
      })),
      spareParts: (body.spareParts ?? []).map(x => ({
        IdSparePartName: x.idSparePartName,
        idSparePartName: x.idSparePartName,
        Quantity: x.quantity,
        quantity: x.quantity,
      })),
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
