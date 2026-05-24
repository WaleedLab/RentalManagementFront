import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import { JournalEntryService } from '../../../../finance/services/journals/journal-entry.service';
import {
  AccountingCashFlowPoint,
  AccountingProfitPoint,
  AccountingRevenueExpensePoint,
} from '../../../models/dashboard/accounting-summary.model';
import {
  ACCOUNTING_JOURNAL_CHART_PAGE_SIZE,
  ACCOUNTING_PAYMENT_PAGE_SIZE,
  AccountingDashboardQueryContext,
  BOND_TYPE_PAYMENT_VOUCHER,
  BOND_TYPE_RECEIPT,
} from './accounting-dashboard-context.model';
import {
  filterJournalsByRange,
  filterPaymentCountsByRange,
  sortKeysAsc,
  toDayKey,
  toMonthKey,
} from './accounting-date.utils';

export interface AccountingChartSeriesResult {
  cashFlow: AccountingCashFlowPoint[];
  revenueVsExpenses: AccountingRevenueExpensePoint[];
  profitTrend: AccountingProfitPoint[];
}

/** Charts from `Journal/Paginated` + monthly buckets from `Paymentcount/Paginated`. */
export function loadAccountingChartSeries(
  journalService: JournalEntryService,
  paymentCountService: PaymentCountService,
  ctx: AccountingDashboardQueryContext,
): Observable<AccountingChartSeriesResult> {
  return forkJoin({
    journals: journalService
      .getPaginated({
        fleetId: ctx.fleetId,
        branchId: ctx.branchId ?? null,
        dateFrom: ctx.dateFrom,
        dateTo: ctx.dateTo,
        pageNumber: 1,
        pageSize: ACCOUNTING_JOURNAL_CHART_PAGE_SIZE,
        orderByDirection: 'ASC',
      })
      .pipe(
        map(response => filterJournalsByRange(response.items ?? [], ctx.dateFrom, ctx.dateTo)),
        catchError(() => of([])),
      ),
    receipts: paymentCountService
      .getPaginated({
        fleetId: ctx.fleetId,
        branchId: ctx.branchId ?? undefined,
        bondTypePaymentcount: BOND_TYPE_RECEIPT,
        pageNumber: 1,
        pageSize: ACCOUNTING_PAYMENT_PAGE_SIZE,
      })
      .pipe(
        map(response =>
          filterPaymentCountsByRange(response.items ?? [], ctx.dateFrom, ctx.dateTo),
        ),
        catchError(() => of([])),
      ),
    payments: paymentCountService
      .getPaginated({
        fleetId: ctx.fleetId,
        branchId: ctx.branchId ?? undefined,
        bondTypePaymentcount: BOND_TYPE_PAYMENT_VOUCHER,
        pageNumber: 1,
        pageSize: ACCOUNTING_PAYMENT_PAGE_SIZE,
      })
      .pipe(
        map(response =>
          filterPaymentCountsByRange(response.items ?? [], ctx.dateFrom, ctx.dateTo),
        ),
        catchError(() => of([])),
      ),
  }).pipe(
    map(({ journals, receipts, payments }) => ({
      cashFlow: buildCashFlowSeries(journals),
      revenueVsExpenses: buildRevenueExpenseSeries(receipts, payments),
      profitTrend: buildProfitTrendSeries(journals),
    })),
  );
}

function buildCashFlowSeries(
  journals: Array<{ date?: string; credit?: number; debtir?: number }>,
): AccountingCashFlowPoint[] {
  const buckets = new Map<string, { inflow: number; outflow: number }>();

  for (const entry of journals) {
    const key = toDayKey(entry.date);
    if (!key) {
      continue;
    }
    const bucket = buckets.get(key) ?? { inflow: 0, outflow: 0 };
    bucket.inflow += Number(entry.credit) || 0;
    bucket.outflow += Number(entry.debtir) || 0;
    buckets.set(key, bucket);
  }

  return sortKeysAsc([...buckets.keys()]).map(key => {
    const bucket = buckets.get(key)!;
    return {
      label: key,
      inflow: bucket.inflow,
      outflow: bucket.outflow,
      net: bucket.inflow - bucket.outflow,
    };
  });
}

function buildRevenueExpenseSeries(
  receipts: Array<{ createdAt?: string; paid?: number }>,
  payments: Array<{ createdAt?: string; paid?: number }>,
): AccountingRevenueExpensePoint[] {
  const revenueByMonth = new Map<string, number>();
  const expenseByMonth = new Map<string, number>();

  for (const item of receipts) {
    const key = toMonthKey(item.createdAt);
    if (!key) {
      continue;
    }
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + (Number(item.paid) || 0));
  }

  for (const item of payments) {
    const key = toMonthKey(item.createdAt);
    if (!key) {
      continue;
    }
    expenseByMonth.set(key, (expenseByMonth.get(key) ?? 0) + (Number(item.paid) || 0));
  }

  const keys = sortKeysAsc([
    ...new Set([...revenueByMonth.keys(), ...expenseByMonth.keys()]),
  ]);

  return keys.map(key => ({
    label: key,
    revenue: revenueByMonth.get(key) ?? 0,
    expenses: expenseByMonth.get(key) ?? 0,
  }));
}

function buildProfitTrendSeries(
  journals: Array<{ date?: string; credit?: number; debtir?: number; balannce?: number }>,
): AccountingProfitPoint[] {
  const buckets = new Map<string, number>();

  for (const entry of journals) {
    const key = toMonthKey(entry.date);
    if (!key) {
      continue;
    }
    const balance = Number(entry.balannce);
    const profit =
      Number.isFinite(balance) && balance !== 0
        ? balance
        : (Number(entry.credit) || 0) - (Number(entry.debtir) || 0);
    buckets.set(key, (buckets.get(key) ?? 0) + profit);
  }

  return sortKeysAsc([...buckets.keys()]).map(key => ({
    label: key,
    value: buckets.get(key) ?? 0,
  }));
}
