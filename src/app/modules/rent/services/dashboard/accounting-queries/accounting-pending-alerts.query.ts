import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { PendingAccountingEntryService } from '../../pending-accounting-entries/pending-accounting-entry.service';
import { AccountingAlert } from '../../../models/dashboard/accounting-summary.model';
import {
  ACCOUNTING_PENDING_ALERTS_PAGE_SIZE,
  AccountingDashboardQueryContext,
} from './accounting-dashboard-context.model';

/** `PendingAccountingEntry/Paginated` — unposted entries for the alerts panel. */
export function loadAccountingPendingAlerts(
  pendingService: PendingAccountingEntryService,
  ctx: AccountingDashboardQueryContext,
): Observable<AccountingAlert[]> {
  return pendingService
    .getPaginated({
      fleetId: ctx.fleetId,
      branchId: ctx.branchId,
      isPosted: false,
      pageNumber: 1,
      pageSize: ACCOUNTING_PENDING_ALERTS_PAGE_SIZE,
    })
    .pipe(
      map(response =>
        (response.items ?? []).map(entry => {
          const parts = [
            entry.description,
            entry.entryDate,
            entry.amount != null ? String(entry.amount) : '',
            entry.paymentcountId ? `#${entry.paymentcountId}` : '',
          ].filter(part => String(part ?? '').trim());

          return {
            type: 'warning' as const,
            title: 'Pending accounting entry',
            description: parts.join(' · ') || 'Unposted entry',
          };
        }),
      ),
      catchError(() => of([])),
    );
}
