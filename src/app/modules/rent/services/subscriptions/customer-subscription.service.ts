import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { PaginatedAggregatorResponse } from '../../../../core/interfaces';

import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams } from '../../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import {
  CustomerSubscription,
  CustomerSubscriptionPaginatedRequest,
  CustomerSubscriptionUpsertRequest,
} from '../../models/subscriptions/customer-subscription.model';
import { normalizeCustomerSubscription } from '../../models/subscriptions/customer-subscription.normalizer';

@Injectable({
  providedIn: 'root',
})
export class CustomerSubscriptionService {
  private api = inject(BaseService);
  private readonly base = 'SubscriptionsOfCustomer';

  getList(fleetId?: string | null): Observable<CustomerSubscription[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, buildFleetQueryParams(fleetId, 'fleet')).pipe(
      map(items => (items ?? []).map(normalizeCustomerSubscription)),
    );
  }

  getPaginated(
    params: CustomerSubscriptionPaginatedRequest,
  ): Observable<PaginatedAggregatorResponse<CustomerSubscription>> {
    return this.api
      .getData<unknown>(
        `${this.base}/Paginated`,
        {
          ...buildFleetQueryParams(params.fleetId, 'both'),
          PageNumber: params.pageNumber,
          PageSize: params.pageSize,
          Search: params.search,
          OrderByDirection: params.orderByDirection,
          OrderBy: params.orderBy,
          pageNumber: params.pageNumber,
          pageSize: params.pageSize,
          search: params.search,
          orderByDirection: params.orderByDirection,
          orderBy: params.orderBy,
        },
        { suppressErrorToast: true },
      )
      .pipe(map(response => normalizePaginatedResponse(response, normalizeCustomerSubscription)));
  }

  getById(id: number | string, fleetId?: string | null): Observable<CustomerSubscription> {
    if (!fleetId) {
      throw new Error('FleetId is required');
    }

    return this.api
      .getData<unknown>(`${this.base}/${id}/${fleetId}`)
      .pipe(map(item => normalizeCustomerSubscription(item)));
  }

  create(payload: CustomerSubscriptionUpsertRequest): Observable<CustomerSubscription> {
    return this.api
      .postData<unknown>(this.base, payload)
      .pipe(map(item => normalizeCustomerSubscription(item)));
  }

  update(payload: CustomerSubscriptionUpsertRequest): Observable<CustomerSubscription> {
    return this.api
      .putData<unknown>(`${this.base}/${payload.id}`, payload)
      .pipe(map(item => normalizeCustomerSubscription(item)));
  }
}
