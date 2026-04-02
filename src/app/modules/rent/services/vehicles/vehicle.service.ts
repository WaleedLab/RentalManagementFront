import { Injectable, inject } from '@angular/core';

import { Observable, catchError, from, map, switchMap, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions, BaseService } from '../../../../shared/services/base/base.service';
import {
  buildFleetQueryParams,
  normalizeFleetId,
} from '../../../../shared/utils/fleet-query.utils';
import { buildImageUploadPayload } from '../../../../shared/utils/image-upload.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { Vehicle, VehicleFilters, VehicleUpsertRequest } from '../../models';
import { normalizeVehicle } from '../../models/vehicles/vehicle.normalizer';

@Injectable({
  providedIn: 'root',
})
export class VehicleService {
  private api = inject(BaseService);
  private readonly base = 'Vehicle';

  getPaginated(
    params: VehicleFilters,
    options?: BaseRequestOptions,
  ): Observable<PaginatedAggregatorResponse<Vehicle>> {
    return this.api
      .getData<unknown>(
        `${this.base}/Paginated`,
        {
          ...buildFleetQueryParams(params.fleetId, 'both'),
          BranchId: params.branchId ?? undefined,
          status: params.status || undefined,
          Search: params.search,
          PageNumber: params.pageNumber,
          PageSize: params.pageSize,
          OrderBy: params.orderBy,
          OrderByDirection: params.orderByDirection,
          search: params.search,
          pageNumber: params.pageNumber,
          pageSize: params.pageSize,
          orderBy: params.orderBy,
          orderByDirection: params.orderByDirection,
        },
        options,
      )
      .pipe(map(response => normalizePaginatedResponse(response, normalizeVehicle)));
  }

  getById(id: string, fleetId?: string | null): Observable<Vehicle> {
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!normalizedFleetId) {
      return this.getByIdFromList(id);
    }

    return this.api.getData<unknown>(`${this.base}/${id}/${normalizedFleetId}`).pipe(
      map(normalizeVehicle),
      catchError(error => this.getByIdFromList(id, normalizedFleetId, error)),
    );
  }

  create(body: VehicleUpsertRequest): Observable<unknown> {
    return from(this.toApiPayload(body)).pipe(
      switchMap(payload => this.api.postData(this.base, payload)),
    );
  }

  update(body: VehicleUpsertRequest): Observable<unknown> {
    return from(this.toApiPayload(body)).pipe(
      switchMap(payload => this.api.putData(`${this.base}/${body.id}`, payload)),
    );
  }

  private async toApiPayload(body: VehicleUpsertRequest): Promise<Record<string, unknown>> {
    const imagePayload = await buildImageUploadPayload(body.image);
    return {
      id: body.id,
      color: body.color,
      insuranceNumber: body.insuranceNumber,
      insuranceType: body.insuranceType,
      insuranceExpires: body.insuranceExpires,
      licenseExpirationDate: body.licenseExpirationDate,
      insurancePolicyNumber: body.insurancePolicyNumber,
      operatinCard: body.operatinCard,
      validityCarRegistration: body.validityCarRegistration,
      fleetId: body.fleetId,
      branchId: body.branchId,
      idCategoryVehicle: body.idCategoryVehicle,
      vin: body.vin,
      yearMake: body.yearMake,
      engine: body.engine,
      serialNumber: body.serialNumber,
      plateNumber: body.plateNumber,
      countKm: body.countKm,
      capacitOil: body.capacitOil,
      status: body.status,
      isActive: body.isActive,
      notes: body.notes,
      url: imagePayload?.attachment,
      Url: imagePayload?.attachment,
      imageExtension: imagePayload?.extension,
      ImageExtension: imagePayload?.extension,
      attachment: imagePayload?.attachment,
      Attachment: imagePayload?.attachment,
      extension: imagePayload?.extension,
      Extension: imagePayload?.extension,
    };
  }

  private getByIdFromList(
    id: string,
    fleetId?: string,
    sourceError?: unknown,
  ): Observable<Vehicle> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(fleetId, 'both'),
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => (items ?? []).map(normalizeVehicle)),
        map(items => items.find(item => String(item.id) === String(id))),
        map(item => {
          if (!item) {
            throw sourceError ?? new Error('Vehicle not found');
          }
          return item;
        }),
        catchError(error => throwError(() => sourceError ?? error)),
      );
  }
}
