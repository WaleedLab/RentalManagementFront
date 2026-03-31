import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import type { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions } from '../../../../shared/services/base/base.service';
import { BaseService } from '../../../../shared/services/base/base.service';
import type { Fleet, FleetUpsertRequest, PaginatedRequest } from '../../models';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizeFleet } from '../../models/fleet/fleet.normalizer';

@Injectable({
  providedIn: 'root',
})
export class FleetService {
  private api = inject(BaseService);

  private readonly base = 'Fleet';

  getPaginated(params: PaginatedRequest, options?: BaseRequestOptions): Observable<PaginatedAggregatorResponse<Fleet>> {
    return this.api.getData<unknown>(`${this.base}/Paginated`, {
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      Search: params.search,
      pageNumber: params.pageNumber,
      pageSize: params.pageSize,
      search: params.search,
    }, options).pipe(map(response => normalizePaginatedResponse(response, normalizeFleet)));
  }

  getById(id: string): Observable<Fleet> {
    return this.api.getData<unknown>(`${this.base}/${id}`).pipe(map(normalizeFleet));
  }

  create(body: FleetUpsertRequest): Observable<Fleet> {
    return this.api.postData<Fleet>(this.base, body);
  }

  update(body: FleetUpsertRequest & { id: string }): Observable<Fleet> {
    return this.api.putData<Fleet>(`${this.base}/${body.id}`, body);
  }
}




