import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';

import type { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions } from '../../../../shared/services/base/base.service';
import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import type { Branch, BranchPaginatedRequest, BranchUpsertRequest } from '../../models';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizeBranch } from '../../models/branches/branch.normalizer';

@Injectable({
  providedIn: 'root',
})
export class BranchService {
  private api = inject(BaseService);
  private readonly base = 'Branch';

  getList(fleetId?: string | null): Observable<Branch[]> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(fleetId, 'both'),
        },
        { suppressErrorToast: true },
      )
      .pipe(map(items => (items ?? []).map(normalizeBranch)));
  }

  getPaginated(
    params: BranchPaginatedRequest,
    options?: BaseRequestOptions,
  ): Observable<PaginatedAggregatorResponse<Branch>> {
    return this.api.getData<unknown>(
      `${this.base}/Paginated`,
      {
        ...buildFleetQueryParams(params.fleetId, 'both'),
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        Search: params.search,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        search: params.search,
        OrderBy: params.orderBy as any,
        OrderByDirection: params.orderByDirection,
        orderBy: params.orderBy as any,
        orderByDirection: params.orderByDirection,
      },
      options,
    ).pipe(map(response => normalizePaginatedResponse(response, normalizeBranch)));
  }

  getById(id: number, fleetId?: string | null): Observable<Branch> {
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!normalizedFleetId) {
      return this.getByIdFromList(id);
    }

    return this.api.getData<unknown>(`${this.base}/${id}/${normalizedFleetId}`).pipe(
      map(normalizeBranch),
      catchError(error => this.getByIdFromList(id, normalizedFleetId, error)),
    );
  }

  create(body: BranchUpsertRequest): Observable<Branch> {
    return this.api.postData<Branch>(this.base, body);
  }

  update(id: number, body: BranchUpsertRequest): Observable<Branch> {
    return this.api.putData<Branch>(`${this.base}/${id}`, {
      ...body,
      id,
      Id: id,
    } as BranchUpsertRequest & { Id: number });
  }

  changeStatus(id: number, isActive: boolean): Observable<boolean> {
    return this.api.putData<boolean>(`${this.base}/Status/${id}`, { isActive });
  }

  softDelete(id: number): Observable<boolean> {
    return this.api.patchData<boolean>(`${this.base}/SoftDelete/${id}`, {});
  }

  private getByIdFromList(
    id: number,
    fleetId?: string,
    sourceError?: unknown,
  ): Observable<Branch> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(fleetId, 'both'),
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => (items ?? []).map(normalizeBranch)),
        map(items => items.find(item => item.id === id)),
        map(item => {
          if (!item) {
            throw sourceError ?? new Error('Branch not found');
          }
          return item;
        }),
        catchError(error => throwError(() => sourceError ?? error)),
      );
  }
}




