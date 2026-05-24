import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { JournalEntryService } from '../../../../finance/services/journals/journal-entry.service';
import { AccountingRecentJournal } from '../../../models/dashboard/accounting-summary.model';
import {
  ACCOUNTING_JOURNAL_RECENT_PAGE_SIZE,
  AccountingDashboardQueryContext,
} from './accounting-dashboard-context.model';

/** `Journal/Paginated` — latest journal rows for the dashboard table. */
export function loadAccountingRecentJournals(
  journalService: JournalEntryService,
  ctx: AccountingDashboardQueryContext,
): Observable<AccountingRecentJournal[]> {
  return journalService
    .getPaginated({
      fleetId: ctx.fleetId,
      branchId: ctx.branchId ?? null,
      dateFrom: ctx.dateFrom,
      dateTo: ctx.dateTo,
      pageNumber: 1,
      pageSize: ACCOUNTING_JOURNAL_RECENT_PAGE_SIZE,
      orderByDirection: 'DESC',
    })
    .pipe(
      map(response =>
        (response.items ?? []).map(entry => ({
          journalNumber: String(entry.journalNumper ?? entry.id ?? ''),
          date: entry.date ?? '',
          debit: Number(entry.debtir) || 0,
          credit: Number(entry.credit) || 0,
          isBalanced: Math.abs(Number(entry.balannce) || 0) < 0.01,
        })),
      ),
      catchError(() => of([])),
    );
}
