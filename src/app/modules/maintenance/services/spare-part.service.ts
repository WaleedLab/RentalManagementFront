import { Injectable, inject } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../core/interfaces';
import { BaseService } from '../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../shared/utils/paginated-response.normalizer';
import { SparePart, SparePartFilters, SparePartUpsertRequest } from '../models/spare-part.model';
import { normalizeSparePart } from '../models/spare-part.normalizer';

@Injectable({ providedIn: 'root' })
export class SparePartService {
  private api = inject(BaseService);
  private readonly base = 'SparePartNames';

  getPaginated(params: SparePartFilters): Observable<PaginatedAggregatorResponse<SparePart>> {
    const orderBy = params.orderBy ?? 0;
    const direction = params.orderByDirection ?? 'DESC';
    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        ...buildFleetQueryParams(params.fleetId, 'both'),
        Fleetid: normalizeFleetId(params.fleetId) ?? undefined,
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
      .pipe(map(response => normalizePaginatedResponse(response, normalizeSparePart)));
  }

  getById(id: string, fleetId?: string | null): Observable<SparePart> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    return this.api
      .getData<unknown>(`${this.base}/${encodeURIComponent(id)}/${encodeURIComponent(fid)}`)
      .pipe(map(raw => normalizeSparePart(raw)));
  }

  create(body: SparePartUpsertRequest): Observable<unknown> {
    return this.api.postData(this.base, this.toPayload(body));
  }

  update(body: SparePartUpsertRequest): Observable<unknown> {
    if (!body.id) {
      return throwError(() => new Error('Id is required for update'));
    }
    return this.api.putData(`${this.base}/${encodeURIComponent(body.id)}`, this.toPayload(body));
  }

  softDelete(id: string | number, fleetId: string): Observable<unknown> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    return this.api.patchData(`${this.base}/SoftDelete/${encodeURIComponent(String(id))}/${encodeURIComponent(fid)}`, {});
  }

  private toPayload(body: SparePartUpsertRequest): Record<string, unknown> {
    const idNum = body.id ? Number(body.id) : undefined;
    return {
      Id: idNum,
      id: idNum,
      FleetId: body.fleetId,
      fleetId: body.fleetId,
      Name: body.name,
      name: body.name,
      Number: body.number,
      number: body.number,
      Description: body.description ?? null,
      description: body.description ?? null,
    };
  }
}
