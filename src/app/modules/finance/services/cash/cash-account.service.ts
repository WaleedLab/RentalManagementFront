import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { buildBranchQueryParams, withBranchIdPayload } from '../../../../shared/utils/branch-id.util';
import { buildFleetQueryParams } from '../../../../shared/utils/fleet-query.utils';
import { CashAccount, CreateCashAccountRequest } from '../../models/cash/cash-account.model';
import { normalizeCashAccount } from '../../models/cash/cash-account.normalizer';

@Injectable({
  providedIn: 'root',
})
export class CashAccountService {
  private api = inject(BaseService);
  private readonly base = 'Cash';

  /**
   * `GetCashsQuery` / `GetCashsPaginatedQuery` — filters by fleet + branch.
   * Pass login branch or `0` when the user has no branch claim.
   */
  getList(fleetId?: string | null, idBranch?: number | null): Observable<CashAccount[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, {
      ...buildFleetQueryParams(fleetId, 'both'),
      ...buildBranchQueryParams(idBranch),
    }).pipe(
      map(items => (items ?? []).map(normalizeCashAccount)),
    );
  }

  create(payload: CreateCashAccountRequest): Observable<unknown> {
    return this.api.postData<unknown>(this.base, withBranchIdPayload(payload, payload.idBranch));
  }
}

