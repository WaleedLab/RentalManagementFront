import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams } from '../../../../shared/utils/fleet-query.utils';
import {
  CustomerSubscription,
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
