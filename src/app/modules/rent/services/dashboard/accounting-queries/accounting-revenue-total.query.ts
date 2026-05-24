import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import {
  ACCOUNTING_PAYMENT_PAGE_SIZE,
  AccountingDashboardQueryContext,
  BOND_TYPE_RECEIPT,
} from './accounting-dashboard-context.model';
import { filterPaymentCountsByRange, sumPaymentPaid } from './accounting-date.utils';

/** `Paymentcount/Paginated` — BondTypePaymentcount = Receipt (2). */
export function loadAccountingRevenueTotal(
  paymentCountService: PaymentCountService,
  ctx: AccountingDashboardQueryContext,
): Observable<number> {
  return paymentCountService
    .getPaginated({
      fleetId: ctx.fleetId,
      branchId: ctx.branchId ?? undefined,
      bondTypePaymentcount: BOND_TYPE_RECEIPT,
      pageNumber: 1,
      pageSize: ACCOUNTING_PAYMENT_PAGE_SIZE,
      orderByDirection: 'DESC',
      orderBy: 'CreatedAt',
    })
    .pipe(
      map(response =>
        sumPaymentPaid(filterPaymentCountsByRange(response.items ?? [], ctx.dateFrom, ctx.dateTo)),
      ),
      catchError(() => of(0)),
    );
}
