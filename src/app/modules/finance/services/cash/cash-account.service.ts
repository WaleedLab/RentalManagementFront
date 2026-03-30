import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { CashAccount } from '../../models/cash/cash-account.model';
import { normalizeCashAccount } from '../../models/cash/cash-account.normalizer';

@Injectable({
  providedIn: 'root',
})
export class CashAccountService {
  private api = inject(BaseService);
  private readonly base = 'Cash';

  getList(fleetId: string): Observable<CashAccount[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, { IdFleet: fleetId }).pipe(
      map(items => (items ?? []).map(normalizeCashAccount)),
    );
  }
}

