import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { CreatePaymentCountRequest, PaymentCount } from '../../models/payment-counts/payment-count.model';
import { normalizePaymentCount } from '../../models/payment-counts/payment-count.normalizer';

@Injectable({
  providedIn: 'root',
})
export class PaymentCountService {
  private api = inject(BaseService);
  private readonly base = 'Paymentcount';

  getList(fleetId: string, branchId?: string | null): Observable<PaymentCount[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, {
      IdFleet: fleetId,
      BranchId: branchId ?? undefined,
    }).pipe(
      map(items => (items ?? []).map(normalizePaymentCount)),
    );
  }

  create(payload: CreatePaymentCountRequest): Observable<unknown> {
    return this.api.postData<unknown>(this.base, payload);
  }
}

