import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { AccountingSummaryFilters, AccountingSummaryResponse } from '../../models';
import { BaseService } from '../../../../shared/services/base/base.service';

@Injectable({
  providedIn: 'root',
})
export class AccountingDashboardService {
  private api = inject(BaseService);
  private readonly base = 'Dashboard';

  getSummary(filters: AccountingSummaryFilters): Observable<AccountingSummaryResponse> {
    const params = {
      FinancialYearId: filters.financialYearId,
      StartDate: filters.startDate,
      EndDate: filters.endDate,
      Fleetid: filters.fleet,
      BranchId: filters.branch,
    };

    return this.api.getData<AccountingSummaryResponse>(`${this.base}/accounting-summary`, params);
  }
}
