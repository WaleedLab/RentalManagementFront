import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import {
  CategoryVehicle,
  CategoryVehicleFilters,
  CategoryVehicleUpsertRequest,
} from '../../models';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizeCategoryVehicle } from '../../models/category-vehicles/category-vehicle.normalizer';

@Injectable({
  providedIn: 'root',
})
export class CategoryVehicleService {
  private api = inject(BaseService);
  private readonly base = 'CategoryVehicle';

  getList(fleetId?: string | null): Observable<CategoryVehicle[]> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(fleetId, 'both'),
        },
        { suppressErrorToast: true },
      )
      .pipe(map(items => (items ?? []).map(normalizeCategoryVehicle)));
  }

  getPaginated(params: CategoryVehicleFilters): Observable<PaginatedAggregatorResponse<CategoryVehicle>> {
    return this.api.getData<unknown>(`${this.base}/Paginated`, {
      ...buildFleetQueryParams(params.fleetId, 'both'),
      Search: params.search,
      search: params.search,
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      pageNumber: params.pageNumber,
      pageSize: params.pageSize,
    }).pipe(map(response => normalizePaginatedResponse(response, normalizeCategoryVehicle)));
  }

  /**
   * `GET CategoryVehicle/{id:long}/{fleetid:guid}` — see `CategoryVehicleRouting.GetById`.
   */
  getById(id: string, fleetId?: string | null): Observable<CategoryVehicle> {
    const normalizedId = String(id ?? '').trim();
    const numericId = this.toNumericId(normalizedId);
    const normalizedFleetId = normalizeFleetId(fleetId);

    if (!normalizedId) {
      return throwError(() => new Error('Category vehicle id is required'));
    }

    if (!numericId || !normalizedFleetId) {
      return this.getByIdFromList(normalizedId, normalizedFleetId);
    }

    return this.api
      .getData<unknown>(
        `${this.base}/${numericId}/${encodeURIComponent(normalizedFleetId)}`,
        undefined,
        { suppressErrorToast: true },
      )
      .pipe(
        map(normalizeCategoryVehicle),
        catchError(error => this.getByIdFromList(normalizedId, normalizedFleetId, error)),
      );
  }

  create(body: CategoryVehicleUpsertRequest): Observable<unknown> {
    return this.api.postData(this.base, this.toCommandPayload(body));
  }

  /** `PUT CategoryVehicle/{id:long}` */
  update(body: CategoryVehicleUpsertRequest): Observable<unknown> {
    const id = this.toNumericId(body.id);
    if (id == null) {
      return throwError(() => new Error('Id is required for update'));
    }

    return this.api.putData(`${this.base}/${id}`, this.toCommandPayload({ ...body, id }));
  }

  private getByIdFromList(
    id: string,
    fleetId?: string,
    sourceError?: unknown,
  ): Observable<CategoryVehicle> {
    return this.api
      .getData<unknown[]>(`${this.base}/List`, buildFleetQueryParams(fleetId, 'both'), {
        suppressErrorToast: true,
      })
      .pipe(
        map(items => (items ?? []).map(normalizeCategoryVehicle)),
        map(items => items.find(item => String(item.id) === String(id))),
        map(item => {
          if (!item) {
            throw sourceError ?? new Error('Category vehicle not found');
          }
          return item;
        }),
        catchError(error => throwError(() => sourceError ?? error)),
      );
  }

  private toNumericId(value: string | number | null | undefined): number | null {
    const n = Number(String(value ?? '').trim());
    return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
  }

  /** ASP.NET command binding — send both PascalCase and camelCase keys. */
  private toCommandPayload(body: CategoryVehicleUpsertRequest): Record<string, unknown> {
    const id = this.toNumericId(body.id);
    const fleetId = normalizeFleetId(body.fleetId);

    return {
      ...(id != null ? { Id: id, id } : {}),
      ...(fleetId ? { FleetId: fleetId, fleetId } : {}),
      NameAr: body.nameAr,
      nameAr: body.nameAr,
      NameEn: body.nameEn,
      nameEn: body.nameEn,
      Price_day_low: body.price_day_low,
      price_day_low: body.price_day_low,
      Price_day_high: body.price_day_high,
      price_day_high: body.price_day_high,
      Price_month_low: body.price_month_low,
      price_month_low: body.price_month_low,
      Price_month_high: body.price_month_high,
      price_month_high: body.price_month_high,
      PriceHoureExtraLow: body.priceHoureExtraLow,
      priceHoureExtraLow: body.priceHoureExtraLow,
      PriceHoureExtraHigh: body.priceHoureExtraHigh,
      priceHoureExtraHigh: body.priceHoureExtraHigh,
      CountKMExtraLow: body.countKMExtraLow,
      countKMExtraLow: body.countKMExtraLow,
      CountKMExtraHigh: body.countKMExtraHigh,
      countKMExtraHigh: body.countKMExtraHigh,
      AllowToLow: body.allowToLow,
      allowToLow: body.allowToLow,
      AllowToHigh: body.allowToHigh,
      allowToHigh: body.allowToHigh,
    };
  }
}


