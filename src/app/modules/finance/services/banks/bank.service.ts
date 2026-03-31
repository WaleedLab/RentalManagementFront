import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { normalizeBank } from '../../models/banks/bank.normalizer';
import { Bank, CreateBankRequest } from '../../models/banks/bank.model';

@Injectable({
  providedIn: 'root',
})
export class BankService {
  private api = inject(BaseService);
  private readonly base = 'Bank';

  getList(fleetId: string): Observable<Bank[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, { IdFleet: fleetId }).pipe(
      map(items => (items ?? []).map(normalizeBank)),
    );
  }

  create(payload: CreateBankRequest): Observable<unknown> {
    return this.api.postData<unknown>(this.base, payload);
  }
}

