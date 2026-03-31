import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions } from '../../../../shared/services/base/base.service';
import { User, UserCreateRequest, UserUpdateRequest, UserPrivilegesRequest, PaginatedRequest } from '../../models';
import { BaseService } from '../../../../shared/services/base/base.service';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizeUser } from '../../models/users/user.normalizer';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private api = inject(BaseService);

  private readonly base = 'User';

  getList(status?: string, options?: BaseRequestOptions): Observable<User[]> {
    return this.api.getData<unknown[]>(`${this.base}/user-list`, {
      status,
      Status: status,
    }, options).pipe(map(items => (items ?? []).map(normalizeUser)));
  }

  getPaginated(params: PaginatedRequest, options?: BaseRequestOptions): Observable<PaginatedAggregatorResponse<User>> {
    return this.api.getData<unknown>(`${this.base}/Paginated`, {
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      Search: params.search,
      pageNumber: params.pageNumber,
      pageSize: params.pageSize,
      search: params.search,
    }, options).pipe(map(response => normalizePaginatedResponse(response, normalizeUser)));
  }

  getById(id: string): Observable<User> {
    return this.api.getData<unknown>(`${this.base}/by-id`, { id }).pipe(map(normalizeUser));
  }

  create(body: UserCreateRequest): Observable<unknown> {
    return this.api.postData(`${this.base}/create`, body);
  }

  update(body: UserUpdateRequest): Observable<unknown> {
    return this.api.putData(`${this.base}/update`, body);
  }

  updatePrivileges(body: UserPrivilegesRequest): Observable<unknown> {
    return this.api.putData(`${this.base}/update-user-privileges`, body);
  }
}



