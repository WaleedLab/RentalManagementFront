import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import type { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions } from '../../../../shared/services/base/base.service';
import { BaseService } from '../../../../shared/services/base/base.service';
import type { Branch, BranchPaginatedRequest, BranchUpsertRequest } from '../../models';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizeBranch } from '../../models/branches/branch.normalizer';

@Injectable({
  providedIn: 'root',
})
export class BranchService {
  private api = inject(BaseService);
  private readonly base = 'Branch';

  getPaginated(
    params: BranchPaginatedRequest,
    options?: BaseRequestOptions,
  ): Observable<PaginatedAggregatorResponse<Branch>> {
    return this.api.getData<unknown>(`${this.base}/Paginated`, {
      FleetId: params.fleetId,
      Fleetid: params.fleetId,
      fleetId: params.fleetId,
      fleetid: params.fleetId,
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
    }, options).pipe(map(response => normalizePaginatedResponse(response, normalizeBranch)));
  }

  getById(id: number, fleetId: string): Observable<Branch> {
    return this.api.getData<unknown>(`${this.base}/${id}/${fleetId}`).pipe(map(normalizeBranch));
  }

  create(body: BranchUpsertRequest): Observable<Branch> {
    return this.api.postData<Branch>(this.base, body);
  }

  update(id: number, body: BranchUpsertRequest): Observable<Branch> {
    return this.api.putData<Branch>(`${this.base}/${id}`, body);
  }

  changeStatus(id: number, isActive: boolean): Observable<boolean> {
    return this.api.putData<boolean>(`${this.base}/Status/${id}`, { isActive });
  }

  softDelete(id: number): Observable<boolean> {
    return this.api.patchData<boolean>(`${this.base}/SoftDelete/${id}`, {});
  }
}




