import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { finalize } from 'rxjs';

import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  DashboardAlert,
  DashboardHeatmapCell,
  DashboardKpiItem,
  DashboardSummary,
  DashboardSummaryFilters,
  DashboardTableCustomer,
  DashboardTableVehicle,
} from '../../../models/dashboard/dashboard-summary.model';
import { DashboardService } from '../../../services/dashboard/dashboard.service';
import { AlertsPanelComponent } from '../shared/alerts-panel.component';
import { DashboardCardComponent } from '../shared/dashboard-card.component';
import { DashboardChartComponent } from '../shared/dashboard-chart.component';
import { DashboardTableComponent } from '../shared/dashboard-table.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    PageHeaderComponent,
    DashboardCardComponent,
    DashboardChartComponent,
    DashboardTableComponent,
    AlertsPanelComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly dashboardService = inject(DashboardService);

  loading = signal(false);
  loadError = signal(false);
  summary = signal<DashboardSummary | null>(null);

  filtersForm = this.fb.nonNullable.group({
    startDate: [''],
    endDate: [''],
    fleet: [''],
    branch: [''],
  });

  kpis = computed<DashboardKpiItem[]>(() => this.summary()?.kpis ?? []);
  topVehicles = computed<DashboardTableVehicle[]>(() => this.summary()?.topVehicles ?? []);
  topCustomers = computed<DashboardTableCustomer[]>(() => this.summary()?.topCustomers ?? []);
  alerts = computed<DashboardAlert[]>(() => this.summary()?.alerts ?? []);
  heatmap = computed<DashboardHeatmapCell[]>(() => this.summary()?.heatmap ?? []);

  vehicleColumns = [
    { key: 'vehicleName', label: 'Vehicle Name', format: 'text' as const },
    { key: 'revenue', label: 'Revenue', format: 'currency' as const },
    { key: 'utilization', label: 'Utilization %', format: 'percent' as const },
    { key: 'maintenanceCost', label: 'Maintenance Cost', format: 'currency' as const },
  ];

  customerColumns = [
    { key: 'name', label: 'Name', format: 'text' as const },
    { key: 'totalSpent', label: 'Total Spent', format: 'currency' as const },
    { key: 'bookings', label: 'Number of bookings', format: 'number' as const },
    { key: 'debt', label: 'Debt', format: 'currency' as const },
  ];

  revenueLabels = computed(() => (this.summary()?.revenueSeries ?? []).map(item => item.label));
  revenueValues = computed(() => (this.summary()?.revenueSeries ?? []).map(item => item.value));
  utilizationLabels = computed(() => (this.summary()?.utilizationSeries ?? []).map(item => item.label));
  utilizationValues = computed(() => (this.summary()?.utilizationSeries ?? []).map(item => item.value));

  maxHeatmapValue = computed(() => Math.max(...this.heatmap().map(item => item.bookings), 1));
  heatmapDays = computed(() => [...new Set(this.heatmap().map(item => item.day))]);
  heatmapWeeks = computed(() => [...new Set(this.heatmap().map(item => item.week))]);
  hasNoData = computed(() => {
    const summary = this.summary();
    if (!summary) {
      return false;
    }

    return (
      summary.kpis.length === 0 &&
      summary.revenueSeries.length === 0 &&
      summary.utilizationSeries.length === 0 &&
      summary.topVehicles.length === 0 &&
      summary.topCustomers.length === 0 &&
      summary.alerts.length === 0 &&
      summary.heatmap.length === 0
    );
  });

  ngOnInit(): void {
    this.loadSummary();
  }

  applyFilters(): void {
    this.loadSummary();
  }

  resetFilters(): void {
    this.filtersForm.reset({ startDate: '', endDate: '', fleet: '', branch: '' });
    this.loadSummary();
  }

  getHeatmapValue(day: string, week: string): number {
    return this.heatmap().find(item => item.day === day && item.week === week)?.bookings ?? 0;
  }

  getHeatmapOpacity(day: string, week: string): number {
    return Math.max(0.12, this.getHeatmapValue(day, week) / this.maxHeatmapValue());
  }

  private loadSummary(): void {
    this.loading.set(true);
    this.loadError.set(false);
    const form = this.filtersForm.getRawValue();
    const filters: DashboardSummaryFilters = {
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      fleet: form.fleet || undefined,
      branch: form.branch || undefined,
    };

    this.dashboardService
      .getSummary(filters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: summary => this.summary.set(this.normalizeSummary(summary)),
        error: () => {
          this.summary.set(this.createEmptySummary());
          this.loadError.set(true);
        },
      });
  }

  private normalizeSummary(summary: DashboardSummary | null | undefined): DashboardSummary {
    if (!summary) {
      return this.createEmptySummary();
    }

    const defaults = this.createEmptySummary();
    return {
      ...defaults,
      ...summary,
      kpis: summary.kpis ?? defaults.kpis,
      revenueSeries: summary.revenueSeries ?? defaults.revenueSeries,
      utilizationSeries: summary.utilizationSeries ?? defaults.utilizationSeries,
      topVehicles: summary.topVehicles ?? defaults.topVehicles,
      topCustomers: summary.topCustomers ?? defaults.topCustomers,
      alerts: summary.alerts ?? defaults.alerts,
      heatmap: summary.heatmap ?? defaults.heatmap,
      fleets: summary.fleets?.length ? summary.fleets : defaults.fleets,
      branches: summary.branches?.length ? summary.branches : defaults.branches,
    };
  }

  private createEmptySummary(): DashboardSummary {
    return {
      kpis: [],
      revenueSeries: [],
      utilizationSeries: [],
      topVehicles: [],
      topCustomers: [],
      alerts: [],
      heatmap: [],
      fleets: [
        { value: '', label: 'All Fleets' },
      ],
      branches: [
        { value: '', label: 'All branches' },
      ],
    };
  }
}
