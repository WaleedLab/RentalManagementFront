import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  AccountingAlert,
  AccountingRecentJournal,
  AccountingSummaryFilters,
  AccountingSummaryResponse,
  AccountingTopDebtor,
} from '../../../models';
import { AccountingDashboardService } from '../../../services/dashboard/accounting-dashboard.service';
import { AccountingAlertsComponent } from './shared/accounting-alerts.component';
import { AccountingCardComponent } from './shared/accounting-card.component';
import { AccountingChartComponent } from './shared/accounting-chart.component';
import { AccountingTableComponent } from './shared/accounting-table.component';

@Component({
  selector: 'app-accounting-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    PageHeaderComponent,
    AccountingCardComponent,
    AccountingChartComponent,
    AccountingTableComponent,
    AccountingAlertsComponent,
    DatePickerComponent,
  ],
  templateUrl: './accounting-dashboard.component.html',
  styleUrl: './accounting-dashboard.component.scss',
})
export class AccountingDashboardComponent implements OnInit {
  private fb = inject(FormBuilder);
  private accountingService = inject(AccountingDashboardService);
  private translate = inject(TranslateService);

  loading = signal(false);
  loadError = signal(false);
  summary = signal<AccountingSummaryResponse | null>(null);

  filtersForm = this.fb.nonNullable.group({
    financialYearId: [''],
    startDate: [''],
    endDate: [''],
    fleet: [''],
    branch: [''],
  });

  topDebtors = computed<AccountingTopDebtor[]>(() => this.summary()?.topDebtors ?? []);
  recentJournals = computed<AccountingRecentJournal[]>(() => this.summary()?.recentJournals ?? []);
  alerts = computed<AccountingAlert[]>(() => this.summary()?.alerts ?? []);

  hasNoData = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return false;
    }
    return (
      summary.cashFlow.length === 0 &&
      summary.revenueVsExpenses.length === 0 &&
      summary.profitTrend.length === 0 &&
      summary.topDebtors.length === 0 &&
      summary.recentJournals.length === 0 &&
      summary.alerts.length === 0
    );
  });

  cashFlowLabels = computed(() => (this.summary()?.cashFlow ?? []).map(item => item.label));
  cashFlowSeries = computed(() => {
    const points = this.summary()?.cashFlow ?? [];
    return [
      { label: this.translate.instant('Inflow'), values: points.map(item => item.inflow), color: '#22c55e' },
      { label: this.translate.instant('Outflow'), values: points.map(item => item.outflow), color: '#ef4444' },
    ];
  });

  revenueExpenseLabels = computed(() => (this.summary()?.revenueVsExpenses ?? []).map(item => item.label));
  revenueExpenseSeries = computed(() => {
    const points = this.summary()?.revenueVsExpenses ?? [];
    return [
      { label: this.translate.instant('Revenue'), values: points.map(item => item.revenue), color: '#7f1d3f' },
      { label: this.translate.instant('Expenses'), values: points.map(item => item.expenses), color: '#f59e0b' },
    ];
  });

  profitTrendLabels = computed(() => (this.summary()?.profitTrend ?? []).map(item => item.label));
  profitTrendSeries = computed(() => [
    { label: this.translate.instant('Net Profit'), values: (this.summary()?.profitTrend ?? []).map(item => item.value), color: '#22c55e' },
  ]);

  topDebtorsColumns = [
    { key: 'customerName', label: 'Customer Name', format: 'text' as const },
    { key: 'debtAmount', label: 'Debt Amount', format: 'currency' as const },
  ];

  recentJournalColumns = [
    { key: 'journalNumber', label: 'Journal Number', format: 'text' as const },
    { key: 'date', label: 'Date', format: 'date' as const },
    { key: 'debit', label: 'Debit', format: 'currency' as const },
    { key: 'credit', label: 'Credit', format: 'currency' as const },
    { key: 'isBalanced', label: 'Balance Status', format: 'balance' as const },
  ];

  ngOnInit(): void {
    this.loadSummary();
  }

  applyFilters(): void {
    this.loadSummary();
  }

  resetFilters(): void {
    this.filtersForm.reset({
      financialYearId: '',
      startDate: '',
      endDate: '',
      fleet: '',
      branch: '',
    });
    this.loadSummary();
  }

  private loadSummary(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const form = this.filtersForm.getRawValue();
    const filters: AccountingSummaryFilters = {
      financialYearId: form.financialYearId || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      fleet: form.fleet || undefined,
      branch: form.branch || undefined,
    };

    this.accountingService
      .getSummary(filters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: response => this.summary.set(this.normalizeSummary(response)),
        error: () => {
          this.summary.set(this.createEmptySummary());
          this.loadError.set(true);
        },
      });
  }

  private normalizeSummary(summary: AccountingSummaryResponse | null | undefined): AccountingSummaryResponse {
    if (!summary) {
      return this.createEmptySummary();
    }
    const defaults = this.createEmptySummary();
    return {
      ...defaults,
      ...summary,
      kpis: summary.kpis ?? defaults.kpis,
      cashFlow: summary.cashFlow ?? defaults.cashFlow,
      revenueVsExpenses: summary.revenueVsExpenses ?? defaults.revenueVsExpenses,
      profitTrend: summary.profitTrend ?? defaults.profitTrend,
      topDebtors: summary.topDebtors ?? defaults.topDebtors,
      recentJournals: summary.recentJournals ?? defaults.recentJournals,
      alerts: summary.alerts ?? defaults.alerts,
      filters: {
        financialYears: summary.filters?.financialYears?.length ? summary.filters.financialYears : defaults.filters.financialYears,
        fleets: summary.filters?.fleets?.length ? summary.filters.fleets : defaults.filters.fleets,
        branches: summary.filters?.branches?.length ? summary.filters.branches : defaults.filters.branches,
      },
    };
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
