import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions } from '../../../../shared/services/base/base.service';
import {
  ApiResponse,
  PrivilegeTypeLookup,
  PrivilegeTypeCreateRequest,
  PrivilegeTypeUpdateRequest,
  PrivilegeRoleItem,
  PaginatedRequest,
} from '../../models';
import { BaseService } from '../../../../shared/services/base/base.service';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizePrivilege } from '../../models/privileges/privilege.normalizer';

@Injectable({
  providedIn: 'root',
})
export class PrivilegeService {
  private api = inject(BaseService);

  private readonly base = 'PrivilegeTypeLookup';

  getList(options?: BaseRequestOptions): Observable<PrivilegeTypeLookup[]> {
    return this.api.getData<unknown[]>(`${this.base}/privilegeTypeLookup-list`, undefined, options).pipe(
      map(items => (items ?? []).map(normalizePrivilege)),
    );
  }

  getById(id: string): Observable<PrivilegeTypeLookup> {
    return this.api.getData<unknown>(`${this.base}/by-id`, { id }).pipe(map(normalizePrivilege));
  }

  getPaginated(params: PaginatedRequest): Observable<ApiResponse<PaginatedAggregatorResponse<PrivilegeTypeLookup>>> {
    return this.api.getData<unknown>(`${this.base}/Paginated`, {
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      Search: params.search,
      pageNumber: params.pageNumber,
      pageSize: params.pageSize,
      search: params.search,
    }).pipe(
      map(data => ({
        data: normalizePaginatedResponse(data, normalizePrivilege),
        succeeded: true,
        errors: [],
        propertyErrors: {},
        httpStatusCode: 200,
      })),
    );
  }

  getPrivilegesByRole(): Observable<PrivilegeRoleItem[]> {
    return this.api.getData<PrivilegeRoleItem[]>(`${this.base}/privileges-role`);
  }

  create(body: PrivilegeTypeCreateRequest): Observable<unknown> {
    return this.api.postData(`${this.base}/create`, body);
  }

  update(body: PrivilegeTypeUpdateRequest): Observable<unknown> {
    return this.api.putData(`${this.base}/update`, body);
  }
}



