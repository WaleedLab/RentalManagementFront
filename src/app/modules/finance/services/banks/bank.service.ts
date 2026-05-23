import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { withBranchIdPayload } from '../../../../shared/utils/branch-id.util';
import { buildFleetQueryParams } from '../../../../shared/utils/fleet-query.utils';
import { normalizeBank } from '../../models/banks/bank.normalizer';
import { Bank, CreateBankRequest, UpdateBankRequest } from '../../models/banks/bank.model';

@Injectable({
  providedIn: 'root',
})
export class BankService {
  private api = inject(BaseService);
  private readonly base = 'Bank';

  getList(fleetId?: string | null): Observable<Bank[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, {
      ...buildFleetQueryParams(fleetId, 'both'),
    }).pipe(
      map(items => (items ?? []).map(normalizeBank)),
    );
  }

  create(payload: CreateBankRequest): Observable<unknown> {
    return this.api.postData<unknown>(this.base, withBranchIdPayload(payload, payload.idBranch), {
      suppressErrorToast: true,
    });
  }

  update(payload: UpdateBankRequest): Observable<unknown> {
    return this.api.putData<unknown>(this.base, withBranchIdPayload(payload, payload.idBranch), {
      suppressErrorToast: true,
    });
  }

  delete(id: string, idBranch?: number): Observable<unknown> {
    const branch = idBranch ?? 0;
    return this.api.deleteData<unknown>(`${this.base}/${id}`, {
      idBranch: String(branch),
      IdBranch: String(branch),
    } as Record<string, string | number | boolean | undefined>);
  }
}
