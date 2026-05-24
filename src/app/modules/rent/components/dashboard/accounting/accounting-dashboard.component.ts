import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { FinancialYearService } from '../../../../finance/services/financial-years/financial-year.service';
import { FinancialYear } from '../../../../finance/models/financial-years/financial-year.model';
import {
  AccountingInsight,
  AccountingSectionKey,
  AccountingSectionState,
  FinancialFeedItem,
  FinancialHeroStatus,
} from '../../../models/dashboard/accounting-intelligence.model';
import {
  AccountingSummaryFilters,
  AccountingSummaryResponse,
} from '../../../models';
import { AccountingDashboardService } from '../../../services/dashboard/accounting-dashboard.service';
import {
  buildAccountingInsights,
  buildFinancialFeed,
  buildFinancialHeroStatus,
  buildTimelineSummary,
} from '../../../services/dashboard/accounting-intelligence.util';
import { resolveDatePreset, DatePresetKey } from '../../../services/dashboard/accounting-date-presets.util';
import { AccountingDashboardQueryContext } from '../../../services/dashboard/accounting-queries/accounting-dashboard-context.model';
import { toDateOnlyInput } from '../../../services/dashboard/accounting-queries/accounting-date.utils';
import { DatePresetKey as CommandPresetKey } from './shared/accounting-command-bar.component';
import { AccountingCommandBarComponent } from './shared/accounting-command-bar.component';
import { AccountingHeroStatusComponent } from './shared/accounting-hero-status.component';
import { AccountingInsightStripComponent } from './shared/accounting-insight-strip.component';
import { AccountingChartComponent } from './shared/accounting-chart.component';
import { AccountingActivityFeedComponent } from './shared/accounting-activity-feed.component';
import { AccountingFeaturePlaceholderComponent } from './shared/accounting-feature-placeholder.component';
import { AccountingAlertStackComponent } from './shared/accounting-alert-stack.component';

@Component({
  selector: 'app-accounting-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    AccountingCommandBarComponent,
    AccountingHeroStatusComponent,
    AccountingInsightStripComponent,
    AccountingChartComponent,
    AccountingActivityFeedComponent,
    AccountingFeaturePlaceholderComponent,
    AccountingAlertStackComponent,
  ],
  templateUrl: './accounting-dashboard.component.html',
  styleUrl: './accounting-dashboard.component.scss',
})
export class AccountingDashboardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private accountingService = inject(AccountingDashboardService);
  private financialYearService = inject(FinancialYearService);
  private authState = inject(AuthStateService);
  private translate = inject(TranslateService);

  private financialYearsCache: FinancialYear[] = [];

  summary = signal<AccountingSummaryResponse | null>(null);
  fleetRequiredError = signal(false);

  sectionState = signal<Record<AccountingSectionKey, AccountingSectionState>>({
    filters: 'idle',
    hero: 'idle',
    trends: 'idle',
    activity: 'idle',
  });

  filtersForm = this.fb.nonNullable.group({
    financialYearId: [''],
    startDate: [''],
    endDate: [''],
    fleet: [''],
    branch: [''],
  });

  heroStatus = computed<FinancialHeroStatus | null>(() => {
    const summary = this.summary();
    return summary ? buildFinancialHeroStatus(summary) : null;
  });

  insights = computed<AccountingInsight[]>(() => {
    const summary = this.summary();
    return summary ? buildAccountingInsights(summary) : [];
  });

  feedItems = computed<FinancialFeedItem[]>(() => {
    const summary = this.summary();
    return summary ? buildFinancialFeed(summary) : [];
  });

  timelineSummary = computed(() => {
    const summary = this.summary();
    return summary ? buildTimelineSummary(summary) : { postedCount: 0, pendingCount: 0, netFlow: 0 };
  });

  filtersLoading = computed(() => this.sectionState().filters === 'loading');
  heroLoading = computed(() => this.sectionState().hero === 'loading');
  trendsLoading = computed(() => this.sectionState().trends === 'loading');
  activityLoading = computed(() => this.sectionState().activity === 'loading');
  heroError = computed(() => this.sectionState().hero === 'error');
  trendsError = computed(() => this.sectionState().trends === 'error');
  activityError = computed(() => this.sectionState().activity === 'error');

  cashFlowLabels = computed(() => (this.summary()?.cashFlow ?? []).map(item => item.label));
  cashFlowSeries = computed(() => {
    const points = this.summary()?.cashFlow ?? [];
    return [
      { label: this.translate.instant('Inflow'), values: points.map(item => item.inflow) },
      { label: this.translate.instant('Outflow'), values: points.map(item => item.outflow) },
    ];
  });

  revenueExpenseLabels = computed(() => (this.summary()?.revenueVsExpenses ?? []).map(item => item.label));
  revenueExpenseSeries = computed(() => {
    const points = this.summary()?.revenueVsExpenses ?? [];
    return [
      { label: this.translate.instant('Revenue'), values: points.map(item => item.revenue) },
      { label: this.translate.instant('Expenses'), values: points.map(item => item.expenses) },
    ];
  });

  profitTrendLabels = computed(() => (this.summary()?.profitTrend ?? []).map(item => item.label));
  profitTrendSeries = computed(() => [
    {
      label: this.translate.instant('Net Profit'),
      values: (this.summary()?.profitTrend ?? []).map(item => item.value),
    },
  ]);

  ngOnInit(): void {
    this.filtersForm.patchValue({
      fleet: this.authState.fleetId() ?? '',
      branch: this.authState.branchId() ? String(this.authState.branchId()) : '',
    });

    this.filtersForm.controls.financialYearId.valueChanges.subscribe(yearId => {
      if (yearId) {
        this.syncDatesFromFinancialYear(yearId);
      }
    });

    this.loadDashboard();
  }

  applyFilters(): void {
    this.loadDashboard();
  }

  resetFilters(): void {
    this.filtersForm.reset({
      financialYearId: '',
      startDate: '',
      endDate: '',
      fleet: this.authState.fleetId() ?? '',
      branch: this.authState.branchId() ? String(this.authState.branchId()) : '',
    });
    this.loadDashboard();
  }

  applyDatePreset(preset: CommandPresetKey): void {
    const range = resolveDatePreset(preset as DatePresetKey);
    this.filtersForm.patchValue(range);
    this.loadDashboard();
  }

  retrySection(section: AccountingSectionKey): void {
    const filters = this.buildFilters();
    const ctx = this.accountingService.buildQueryContext(filters);
    if (!ctx) {
      return;
    }

    if (section === 'hero') {
      this.loadHero(ctx);
    } else if (section === 'trends') {
      this.loadTrends(ctx);
    } else if (section === 'activity') {
      this.loadActivity(ctx);
    }
  }

  private loadDashboard(): void {
    const filters = this.buildFilters();
    const ctx = this.accountingService.buildQueryContext(filters);

    if (!ctx) {
      this.fleetRequiredError.set(true);
      this.summary.set(this.createEmptySummary());
      this.setSection('filters', 'error');
      return;
    }

    this.fleetRequiredError.set(false);
    this.summary.set(this.createEmptySummary());
    this.setSection('filters', 'loading');
    this.setSection('hero', 'loading');
    this.setSection('trends', 'loading');
    this.setSection('activity', 'loading');

    this.accountingService
      .loadFilterOptions(filters)
      .pipe(catchError(() => of(this.createEmptySummary().filters)))
      .subscribe({
        next: filterOptions => {
          this.summary.update(current => ({
            ...(current ?? this.createEmptySummary()),
            filters: filterOptions,
          }));
          this.setSection('filters', 'ready');
        },
        error: () => this.setSection('filters', 'error'),
      });

    this.loadHero(ctx);
    this.loadTrends(ctx);
    this.loadActivity(ctx);
  }

  private loadHero(ctx: AccountingDashboardQueryContext): void {
    this.setSection('hero', 'loading');
    this.accountingService
      .loadHeroSection(ctx)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: hero => {
          if (!hero) {
            this.setSection('hero', 'error');
            return;
          }
          this.summary.update(current => ({
            ...(current ?? this.createEmptySummary()),
            kpis: hero.kpis,
          }));
          this.setSection('hero', 'ready');
        },
        error: () => this.setSection('hero', 'error'),
      });
  }

  private loadTrends(ctx: AccountingDashboardQueryContext): void {
    this.setSection('trends', 'loading');
    this.accountingService
      .loadTrendsSection(ctx)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: trends => {
          if (!trends) {
            this.setSection('trends', 'error');
            return;
          }
          this.summary.update(current => ({
            ...(current ?? this.createEmptySummary()),
            cashFlow: trends.cashFlow,
            revenueVsExpenses: trends.revenueVsExpenses,
            profitTrend: trends.profitTrend,
          }));
          this.setSection('trends', 'ready');
        },
        error: () => this.setSection('trends', 'error'),
      });
  }

  private loadActivity(ctx: AccountingDashboardQueryContext): void {
    this.setSection('activity', 'loading');
    this.accountingService
      .loadActivitySection(ctx)
      .pipe(catchError(() => of(null)))
      .subscribe({
        next: activity => {
          if (!activity) {
            this.setSection('activity', 'error');
            return;
          }
          this.summary.update(current => ({
            ...(current ?? this.createEmptySummary()),
            recentJournals: activity.recentJournals,
            alerts: activity.alerts,
          }));
          this.setSection('activity', 'ready');
        },
        error: () => this.setSection('activity', 'error'),
      });
  }

  private buildFilters(): AccountingSummaryFilters {
    const form = this.filtersForm.getRawValue();
    const fleet = form.fleet?.trim() || this.authState.fleetId()?.trim() || '';
    return {
      financialYearId: form.financialYearId || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      fleet: fleet || undefined,
      branch: form.branch || undefined,
    };
  }

  private setSection(key: AccountingSectionKey, state: AccountingSectionState): void {
    this.sectionState.update(current => ({ ...current, [key]: state }));
  }

  private syncDatesFromFinancialYear(yearId: string): void {
    const fleetId = this.filtersForm.controls.fleet.value?.trim();
    if (!fleetId || !yearId) {
      return;
    }

    const apply = (years: FinancialYear[]) => {
      const year = years.find(item => String(item.id) === yearId);
      if (year?.startDate && year?.endDate) {
        this.filtersForm.patchValue(
          {
            startDate: toDateOnlyInput(year.startDate),
            endDate: toDateOnlyInput(year.endDate),
          },
          { emitEvent: false },
        );
      }
    };

    if (this.financialYearsCache.length) {
      apply(this.financialYearsCache);
      return;
    }

    this.financialYearService.getList(fleetId).subscribe({
      next: years => {
        this.financialYearsCache = years;
        apply(years);
      },
    });
  }

  private createEmptySummary(): AccountingSummaryResponse {
    return {
      kpis: {
        totalRevenue: 0,
        totalExpenses: 0,
        netProfit: 0,
        cashBalance: 0,
        bankBalance: 0,
        receivables: 0,
        cashBalanceUnavailable: true,
        bankBalanceUnavailable: true,
        receivablesUnavailable: true,
      },
      cashFlow: [],
      revenueVsExpenses: [],
      profitTrend: [],
      topDebtors: [],
      recentJournals: [],
      alerts: [],
      filters: {
        financialYears: [{ value: '', label: 'All Financial Years' }],
        fleets: [{ value: '', label: 'All Fleets' }],
        branches: [{ value: '', label: 'All branches' }],
      },
    };
  }
}
