import { Injectable, inject } from '@angular/core';

import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';

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
  private static readonly DEBUG_PARAMS = true;

  private typeSafeParams(params: Record<string, string | number | boolean | undefined>): Record<string, string | number | boolean | undefined> {
    return params;
  }

  getList(params: {
    fleetId?: string | null;
    branchId?: number | null;
    status?: Vehicle['status'] | '';
    includeEmptyStatus?: boolean;
  } = {}): Observable<Vehicle[]> {
    const normalizedFleetId = normalizeFleetId(params.fleetId);
    const branchId = params.branchId ?? undefined;
    const status = params.status || undefined;
    const backendStatus = status ? this.toBackendVehicleStatusEnumName(status) : undefined;
    const requestParams = this.typeSafeParams({
      Fleetid: normalizedFleetId ?? undefined,
      Branchid: branchId,
      ...(params.includeEmptyStatus && !backendStatus ? { Stutus: '' } : {}),
      ...(backendStatus ? { Stutus: backendStatus } : {}),
    });

    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        requestParams,
        { suppressErrorToast: true },
      )
      .pipe(map(items => (items ?? []).map(normalizeVehicle)));
  }

  getPaginated(
    params: VehicleFilters,
    options?: BaseRequestOptions,
  ): Observable<PaginatedAggregatorResponse<Vehicle>> {
    const requestParams = this.buildPaginatedParams(params);
    // TEMP DEBUG: remove after backend/params verification.
    if (VehicleService.DEBUG_PARAMS) {
      // eslint-disable-next-line no-console
      console.log('[Vehicle/Paginated] final params', requestParams);
    }
    return this.api
      .getData<unknown>(
        `${this.base}/Paginated`,
        requestParams,
        options,
      )
      .pipe(map(response => normalizePaginatedResponse(response, normalizeVehicle)));
  }

  getStatusCounts(params: {
    fleetId?: string | null;
    branchId?: number | null;
  } = {}): Observable<VehicleStatusCountsResponse> {
    const normalizedFleetId = normalizeFleetId(params.fleetId);
    const requestParams = this.typeSafeParams({
      FleetId: normalizedFleetId ?? undefined,
      BranchId: params.branchId ?? undefined,
    });

    // Prefer the explicit endpoint that maps to GetVehicleStatusCountsQuery.
    return this.api.getData<VehicleStatusCountsResponse>(
      `${this.base}/GetVehicleStatusCounts`,
      requestParams,
      { suppressErrorToast: true },
    ).pipe(
      // Backward compatibility for older API routes.
      catchError(() =>
        this.api.getData<VehicleStatusCountsResponse>(
          `${this.base}/StatusCounts`,
          requestParams,
          { suppressErrorToast: true },
        ),
      ),
      catchError(() => of({ totalCount: 0, statusCounts: [] })),
    );
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

  changeStatus(id: string | number, status: VehicleUpsertRequest['status']): Observable<boolean> {
    const vehicleId = Number(id);
    const vehicleEnumCode = this.toBackendVehicleStatusEnumCode(status);
    const vehicleEnumName = this.toBackendVehicleStatusEnumName(status);
    const endpoint = `${this.base}/Status/${vehicleId}`;

    // Match backend command shape exactly: { id, vehicleEnum }.
    // Try numeric enum first (default ASP.NET behavior), then string enum name as fallback.
    return this.api.putData<boolean>(endpoint, {
      id: vehicleId,
      vehicleEnum: vehicleEnumCode,
    }).pipe(
      catchError(() =>
        this.api.putData<boolean>(endpoint, {
          id: vehicleId,
          vehicleEnum: vehicleEnumName,
        }),
      ),
    );
  }

  softDelete(id: string | number): Observable<boolean> {
    return this.api.patchData<boolean>(`${this.base}/SoftDelete/${id}`, {});
  }

  private async toApiPayload(body: VehicleUpsertRequest): Promise<Record<string, unknown>> {
    const imagePayload = await buildImageUploadPayload(body.image);
    const isAvailable = body.status === 'Available';
    const statusCode =
      body.status === 'Sold'
        ? 0
        : body.status === 'Available'
        ? 1
        : body.status === 'Booked'
          ? 2
          : body.status === 'Maintenance'
            ? 3
            : 4;

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
      Status: body.status,
      vehicleStatus: body.status,
      VehicleStatus: body.status,
      stutus: body.status,
      Stutus: body.status,
      statusCode,
      StatusCode: statusCode,
      isAvailable,
      IsAvailable: isAvailable,
      isAvalible: isAvailable,
      IsAvalible: isAvailable,
      isActive: body.isActive,
      notes: body.notes,
      url: imagePayload?.attachment,
      Url: imagePayload?.attachment,
      imageExtension: imagePayload?.extension ?? '',
      ImageExtension: imagePayload?.extension ?? '',
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

  private toBackendVehicleStatusEnumCode(status: VehicleUpsertRequest['status']): number {
    if (status === 'Sold') {
      return 0; // IsSold
    }

    if (status === 'Booked') {
      return 1; // IsBooking
    }

    if (status === 'Maintenance') {
      return 3; // IsMaintanes
    }

    if (status === 'Inactive') {
      return 4; // IsMangament
    }

    return 2; // IsAvalible
  }

  private toBackendVehicleStatusEnumName(status: VehicleUpsertRequest['status']): string {
    if (status === 'Sold') {
      return 'IsSold';
    }

    if (status === 'Booked') {
      return 'IsBooking';
    }

    if (status === 'Maintenance') {
      return 'IsMaintanes';
    }

    if (status === 'Inactive') {
      return 'IsMangament';
    }

    return 'IsAvalible';
  }

  private toBackendVehicleOrderingEnum(orderBy?: VehicleFilters['orderBy']): string | undefined {
    if (!orderBy) {
      return undefined;
    }

    if (orderBy === 'Year') {
      return 'Year';
    }

    if (orderBy === 'Plantnumber') {
      return 'Plantnumber';
    }

    return undefined;
  }

  private toBackendOrderDirection(direction?: VehicleFilters['orderByDirection']): 'Ascending' | 'Descending' {
    return direction === 'ASC' ? 'Ascending' : 'Descending';
  }

  private buildPaginatedParams(
    params: VehicleFilters,
  ): Record<string, string | number | boolean | undefined> {
    const fleetId = normalizeFleetId(params.fleetId) ?? undefined;
    const orderingEnum = this.toBackendVehicleOrderingEnum(params.orderBy);
    const backendStatus = params.status ? this.toBackendVehicleStatusEnumName(params.status) : undefined;

    return this.typeSafeParams({
      Fleetid: fleetId,
      BranchId: params.branchId ?? undefined,
      CategoryVehiclesId: params.categoryId ?? undefined,
      Search: params.search ?? undefined,
      OrderBy: orderingEnum,
      OrderByDirection: this.toBackendOrderDirection(params.orderByDirection),
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      ...(backendStatus ? { Stutus: backendStatus } : {}),
    });
  }
}

export interface VehicleStatusCountsResponse {
  totalCount: number;
  statusCounts: VehicleStatusCountItem[];
}

export interface VehicleStatusCountItem {
  status: string;
  statusDisplayName: string;
  count: number;
  includedStatuses: string[];
}
