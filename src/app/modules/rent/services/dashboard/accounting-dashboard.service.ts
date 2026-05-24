import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

import { PaymentCountService } from '../../../finance/services/payment-counts/payment-count.service';
import { JournalEntryService } from '../../../finance/services/journals/journal-entry.service';
import { FinancialYearService } from '../../../finance/services/financial-years/financial-year.service';
import { BranchService } from '../branches/branch.service';
import { FleetService } from '../fleet/fleet.service';
import { PendingAccountingEntryService } from '../pending-accounting-entries/pending-accounting-entry.service';
import {
  AccountingKpis,
  AccountingSummaryFilters,
  AccountingSummaryResponse,
} from '../../models/dashboard/accounting-summary.model';
import { loadAccountingChartSeries } from './accounting-queries/accounting-chart-series.query';
import { AccountingDashboardQueryContext } from './accounting-queries/accounting-dashboard-context.model';
import { loadAccountingExpensesTotal } from './accounting-queries/accounting-expenses-total.query';
import {
  AccountingFilterOptionsResult,
  loadAccountingFilterOptions,
} from './accounting-queries/accounting-filters.query';
import { loadAccountingPendingAlerts } from './accounting-queries/accounting-pending-alerts.query';
import { loadAccountingRecentJournals } from './accounting-queries/accounting-journal-recent.query';
import { loadAccountingRevenueTotal } from './accounting-queries/accounting-revenue-total.query';

export interface AccountingHeroSection {
  kpis: AccountingKpis;
}

export interface AccountingTrendsSection {
  cashFlow: AccountingSummaryResponse['cashFlow'];
  revenueVsExpenses: AccountingSummaryResponse['revenueVsExpenses'];
  profitTrend: AccountingSummaryResponse['profitTrend'];
}

export interface AccountingActivitySection {
  recentJournals: AccountingSummaryResponse['recentJournals'];
  alerts: AccountingSummaryResponse['alerts'];
}

@Injectable({
  providedIn: 'root',
})
export class AccountingDashboardService {
  private readonly paymentCountService = inject(PaymentCountService);
  private readonly journalService = inject(JournalEntryService);
  private readonly fleetService = inject(FleetService);
  private readonly branchService = inject(BranchService);
  private readonly financialYearService = inject(FinancialYearService);
  private readonly pendingService = inject(PendingAccountingEntryService);

  buildQueryContext(filters: AccountingSummaryFilters): AccountingDashboardQueryContext | null {
    const fleetId = String(filters.fleet ?? '').trim();
    if (!fleetId) {
      return null;
    }
    const branchRaw = String(filters.branch ?? '').trim();
    const branchNum = branchRaw ? Number(branchRaw) : Number.NaN;

    return {
      fleetId,
      branchId: Number.isFinite(branchNum) && branchNum > 0 ? branchNum : undefined,
      dateFrom: filters.startDate || undefined,
      dateTo: filters.endDate || undefined,
      financialYearId: filters.financialYearId || undefined,
    };
  }

  loadFilterOptions(filters: AccountingSummaryFilters): Observable<AccountingFilterOptionsResult> {
    return loadAccountingFilterOptions(
      this.fleetService,
      this.branchService,
      this.financialYearService,
      filters,
    );
  }

  loadHeroSection(ctx: AccountingDashboardQueryContext): Observable<AccountingHeroSection> {
    return forkJoin({
      revenue: loadAccountingRevenueTotal(this.paymentCountService, ctx),
      expenses: loadAccountingExpensesTotal(this.paymentCountService, ctx),
    }).pipe(
      map(({ revenue, expenses }) => ({
        kpis: {
          totalRevenue: revenue,
          totalExpenses: expenses,
          netProfit: revenue - expenses,
          cashBalance: 0,
          bankBalance: 0,
          receivables: 0,
          cashBalanceUnavailable: true,
          bankBalanceUnavailable: true,
          receivablesUnavailable: true,
        },
      })),
    );
  }

  loadTrendsSection(ctx: AccountingDashboardQueryContext): Observable<AccountingTrendsSection> {
    return loadAccountingChartSeries(
      this.journalService,
      this.paymentCountService,
      ctx,
    ).pipe(
      map(chartSeries => ({
        cashFlow: chartSeries.cashFlow,
        revenueVsExpenses: chartSeries.revenueVsExpenses,
        profitTrend: chartSeries.profitTrend,
      })),
    );
  }

  loadActivitySection(ctx: AccountingDashboardQueryContext): Observable<AccountingActivitySection> {
    return forkJoin({
      recentJournals: loadAccountingRecentJournals(this.journalService, ctx),
      alerts: loadAccountingPendingAlerts(this.pendingService, ctx),
    });
  }

  /** Full load (backward compatible). */
  getSummary(filters: AccountingSummaryFilters): Observable<AccountingSummaryResponse> {
    const ctx = this.buildQueryContext(filters);
    if (!ctx) {
      return throwError(() => new Error('FleetId is required'));
    }

    return this.loadFilterOptions(filters).pipe(
      switchMap(filterOptions =>
        forkJoin({
          hero: this.loadHeroSection(ctx),
          trends: this.loadTrendsSection(ctx),
          activity: this.loadActivitySection(ctx),
        }).pipe(
          map(({ hero, trends, activity }) => ({
            kpis: hero.kpis,
            cashFlow: trends.cashFlow,
            revenueVsExpenses: trends.revenueVsExpenses,
            profitTrend: trends.profitTrend,
            topDebtors: [],
            recentJournals: activity.recentJournals,
            alerts: activity.alerts,
            filters: filterOptions,
          })),
        ),
      ),
    );
  }
}
