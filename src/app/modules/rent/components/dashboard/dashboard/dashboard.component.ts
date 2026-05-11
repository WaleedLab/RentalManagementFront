import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { Booking, Branch, Vehicle } from '../../../models';
import { BookingService, BookingStatusCountsPeriod } from '../../../services/booking/booking.service';
import { BranchService } from '../../../services/branches/branch.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import { DashboardChartComponent } from '../shared/dashboard-chart.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, PageHeaderComponent, DashboardChartComponent, SmoothSelectComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private vehicleService = inject(VehicleService);
  private bookingService = inject(BookingService);
  private branchService = inject(BranchService);
  readonly authState = inject(AuthStateService);
  private translate = inject(TranslateService);

  branches = signal<Branch[]>([]);
  vehicleBranchId = signal<number | ''>('');
  vehicleStatus = signal<Vehicle['status'] | ''>('');
  bookingBranchId = signal<number | ''>('');
  bookingPeriod = signal<BookingStatusCountsPeriod>('ThisMonth');

  vehicleLoading = signal(false);
  vehicleError = signal(false);
  bookingLoading = signal(false);
  bookingError = signal(false);

  vehicleStatusCounts = signal<{ label: string; value: number }[]>([]);
  vehicleByBranch = signal<{ label: string; value: number }[]>([]);
  vehicleByYear = signal<{ label: string; value: number }[]>([]);
  vehicleTotal = signal(0);

  bookingStatusCounts = signal<{ label: string; value: number }[]>([]);
  bookingByBranch = signal<{ label: string; value: number }[]>([]);
  bookingByStatusList = signal<{ label: string; value: number }[]>([]);
  bookingTotal = signal(0);

  branchOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('All branches'), value: '' },
    ...this.branches().map(b => ({
      label: (b.nameAr || b.nameEn || String(b.id)).trim() || String(b.id),
      value: Number(b.id),
    })),
  ]);

  vehicleStatusOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('All statuses'), value: '' },
    { label: this.translate.instant('Dashboard vehicle status available'), value: 'Available' },
    { label: this.translate.instant('Dashboard vehicle status booked'), value: 'Booked' },
    { label: this.translate.instant('Dashboard vehicle status maintenance'), value: 'Maintenance' },
    { label: this.translate.instant('Dashboard vehicle status management'), value: 'Management' },
    { label: this.translate.instant('Dashboard vehicle status sold'), value: 'Sold' },
  ]);

  bookingPeriodOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Dashboard booking period this month'), value: 'ThisMonth' },
    { label: this.translate.instant('Dashboard booking period last 3 months'), value: 'Last3Months' },
    { label: this.translate.instant('Dashboard booking period this year'), value: 'ThisYear' },
  ]);

  chartLabels = (rows: { label: string; value: number }[]) => rows.map(r => r.label);
  chartValues = (rows: { label: string; value: number }[]) => rows.map(r => r.value);

  ngOnInit(): void {
    this.loadBranches();
    this.refreshAll();
  }

  refreshAll(): void {
    this.loadVehicleSection();
    this.loadBookingSection();
  }

  resetVehicleFilters(): void {
    this.vehicleBranchId.set('');
    this.vehicleStatus.set('');
    this.loadVehicleSection();
  }

  resetBookingFilters(): void {
    this.bookingBranchId.set('');
    this.bookingPeriod.set('ThisMonth');
    this.loadBookingSection();
  }

  applyVehicleFilters(): void {
    this.loadVehicleSection();
  }

  applyBookingFilters(): void {
    this.loadBookingSection();
  }

  onVehicleBranchChange(value: number | ''): void {
    this.vehicleBranchId.set(value === '' ? '' : Number(value));
  }

  onVehicleStatusChange(value: string): void {
    this.vehicleStatus.set((value || '') as Vehicle['status'] | '');
  }

  onBookingBranchChange(value: number | ''): void {
    this.bookingBranchId.set(value === '' ? '' : Number(value));
  }

  onBookingPeriodChange(value: string): void {
    const v = value as BookingStatusCountsPeriod;
    if (v === 'ThisMonth' || v === 'Last3Months' || v === 'ThisYear') {
      this.bookingPeriod.set(v);
    }
  }

  private loadBranches(): void {
    const fleetId = this.authState.fleetId() || undefined;
    this.branchService
      .getPaginated({ fleetId, pageNumber: 1, pageSize: 500, search: undefined })
      .subscribe({
        next: page => this.branches.set(page.items ?? []),
        error: () => this.branches.set([]),
      });
  }

  private loadVehicleSection(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.vehicleError.set(false);
      this.vehicleStatusCounts.set([]);
      this.vehicleByBranch.set([]);
      this.vehicleByYear.set([]);
      this.vehicleTotal.set(0);
      return;
    }
    this.vehicleLoading.set(true);
    this.vehicleError.set(false);
    const branchId = this.vehicleBranchId() === '' ? undefined : Number(this.vehicleBranchId());
    const status = this.vehicleStatus() || undefined;

    forkJoin({
      counts: this.vehicleService.getStatusCounts({ fleetId, branchId }),
      list: this.vehicleService.getList({
        fleetId,
        branchId: branchId ?? null,
        status: status ?? '',
        includeEmptyStatus: !status,
      }),
    })
      .pipe(finalize(() => this.vehicleLoading.set(false)))
      .subscribe({
        next: ({ counts, list }) => {
          const rows =
            counts.statusCounts?.map(s => ({
              label: (s.statusDisplayName || s.status || '').trim() || '—',
              value: Number(s.count) || 0,
            })) ?? [];
          this.vehicleStatusCounts.set(rows);
          this.vehicleTotal.set(counts.totalCount ?? rows.reduce((a, b) => a + b.value, 0));
          this.vehicleByBranch.set(this.aggregateField(list, v => String(v.branchName ?? '').trim() || `#${v.branchId ?? ''}`));
          this.vehicleByYear.set(this.aggregateField(list, v => String(v.yearMake ?? '').trim() || '—', 8));
        },
        error: () => {
          this.vehicleError.set(true);
          this.vehicleStatusCounts.set([]);
          this.vehicleByBranch.set([]);
          this.vehicleByYear.set([]);
        },
      });
  }

  private loadBookingSection(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.bookingError.set(false);
      this.bookingStatusCounts.set([]);
      this.bookingByBranch.set([]);
      this.bookingByStatusList.set([]);
      this.bookingTotal.set(0);
      return;
    }
    this.bookingLoading.set(true);
    this.bookingError.set(false);
    const branchId = this.bookingBranchId() === '' ? undefined : Number(this.bookingBranchId());
    const period = this.bookingPeriod();

    const list$ =
      branchId !== undefined && branchId > 0
        ? this.bookingService.getBookings({ fleetId, branchId })
        : this.bookingService.getList({ fleetId, branchId: undefined, includeAllStatuses: true });

    forkJoin({
      counts: this.bookingService.getStatusCounts({ fleetId, branchId, period }),
      list: list$,
    })
      .pipe(finalize(() => this.bookingLoading.set(false)))
      .subscribe({
        next: ({ counts, list }) => {
          const rows =
            counts.statusCounts?.map(s => ({
              label: (s.statusDisplayName || s.status || '').trim() || '—',
              value: Number(s.count) || 0,
            })) ?? [];
          this.bookingStatusCounts.set(rows);
          this.bookingTotal.set(counts.totalCount ?? rows.reduce((a, b) => a + b.value, 0));
          this.bookingByBranch.set(this.aggregateBookingsByBranch(list));
          this.bookingByStatusList.set(this.aggregateBookingsByStatus(list));
        },
        error: () => {
          this.bookingError.set(true);
          this.bookingStatusCounts.set([]);
          this.bookingByBranch.set([]);
          this.bookingByStatusList.set([]);
        },
      });
  }

  private aggregateField(items: Vehicle[], keyFn: (v: Vehicle) => string, topN = 10): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      const k = keyFn(item);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
  }

  private aggregateBookingsByBranch(items: Booking[]): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const b of items) {
      const label = (b.branchName ?? '').trim() || (b.branchId ? `#${b.branchId}` : '—');
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private aggregateBookingsByStatus(items: Booking[]): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const b of items) {
      const label = (b.statusDisplayName ?? '').trim() || String(b.status ?? '—');
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }
}
