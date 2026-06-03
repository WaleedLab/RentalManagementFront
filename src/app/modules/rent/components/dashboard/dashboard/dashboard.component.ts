import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { Maintenance } from '../../../../maintenance/models/maintenance.model';
import { MaintenanceService } from '../../../../maintenance/services/maintenance.service';
import { PaymentCount } from '../../../../finance/models/payment-counts/payment-count.model';
import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import { JournalEntry } from '../../../../finance/models/journals/journal-entry.model';
import { JournalEntryService } from '../../../../finance/services/journals/journal-entry.service';
import { Booking, Branch, TrafficViolation, Vehicle } from '../../../models';
import { BookingService, BookingStatusCountsPeriod } from '../../../services/booking/booking.service';
import { BranchService } from '../../../services/branches/branch.service';
import { TrafficViolationService } from '../../../services/traffic-violations/traffic-violation.service';
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
  private maintenanceService = inject(MaintenanceService);
  private paymentCountService = inject(PaymentCountService);
  private journalEntryService = inject(JournalEntryService);
  private trafficViolationService = inject(TrafficViolationService);
  private branchService = inject(BranchService);
  readonly authState = inject(AuthStateService);
  private translate = inject(TranslateService);

  branches = signal<Branch[]>([]);
  vehicleBranchId = signal<number | ''>('');
  vehicleStatus = signal<Vehicle['status'] | ''>('');
  bookingBranchId = signal<number | ''>('');
  bookingPeriod = signal<BookingStatusCountsPeriod>('ThisMonth');
  maintenanceBranchId = signal<number | ''>('');
  paymentCountBranchId = signal<number | ''>('');
  journalBranchId = signal<number | ''>('');

  vehicleLoading = signal(false);
  vehicleError = signal(false);
  bookingLoading = signal(false);
  bookingError = signal(false);
  maintenanceLoading = signal(false);
  maintenanceError = signal(false);
  paymentCountLoading = signal(false);
  paymentCountError = signal(false);
  journalLoading = signal(false);
  journalError = signal(false);
  trafficViolationLoading = signal(false);
  trafficViolationError = signal(false);

  vehicleStatusCounts = signal<{ label: string; value: number }[]>([]);
  vehicleByBranch = signal<{ label: string; value: number }[]>([]);
  vehicleByYear = signal<{ label: string; value: number }[]>([]);
  vehicleTotal = signal(0);

  bookingStatusCounts = signal<{ label: string; value: number }[]>([]);
  bookingByBranch = signal<{ label: string; value: number }[]>([]);
  bookingByMonth = signal<{ label: string; value: number }[]>([]);
  bookingTotal = signal(0);

  maintenanceStatusCounts = signal<{ label: string; value: number }[]>([]);
  maintenanceByBranch = signal<{ label: string; value: number }[]>([]);
  maintenanceByMonth = signal<{ label: string; value: number }[]>([]);
  maintenanceTotal = signal(0);
  maintenanceCostTotal = signal(0);

  paymentCountByBondType = signal<{ label: string; value: number }[]>([]);
  paymentCountByPaymentType = signal<{ label: string; value: number }[]>([]);
  paymentCountByBranch = signal<{ label: string; value: number }[]>([]);
  paymentCountTotal = signal(0);
  paymentCountPaidTotal = signal(0);

  journalByStatus = signal<{ label: string; value: number }[]>([]);
  journalByType = signal<{ label: string; value: number }[]>([]);
  journalByOperationType = signal<{ label: string; value: number }[]>([]);
  journalTotal = signal(0);
  journalDebitTotal = signal(0);
  journalCreditTotal = signal(0);

  trafficViolationByName = signal<{ label: string; value: number }[]>([]);
  trafficViolationByVehicle = signal<{ label: string; value: number }[]>([]);
  trafficViolationByBookingLink = signal<{ label: string; value: number }[]>([]);
  trafficViolationByMonth = signal<{ label: string; value: number }[]>([]);
  trafficViolationTotal = signal(0);
  trafficViolationFineTotal = signal(0);

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
    { label: this.translate.instant('Dashboard vehicle status management'), value: 'Inactive' },
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
    this.loadMaintenanceSection();
    this.loadPaymentCountSection();
    this.loadJournalSection();
    this.loadTrafficViolationSection();
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

  resetMaintenanceFilters(): void {
    this.maintenanceBranchId.set('');
    this.loadMaintenanceSection();
  }

  resetPaymentCountFilters(): void {
    this.paymentCountBranchId.set('');
    this.loadPaymentCountSection();
  }

  resetJournalFilters(): void {
    this.journalBranchId.set('');
    this.loadJournalSection();
  }

  applyVehicleFilters(): void {
    this.loadVehicleSection();
  }

  applyBookingFilters(): void {
    this.loadBookingSection();
  }

  applyMaintenanceFilters(): void {
    this.loadMaintenanceSection();
  }

  applyPaymentCountFilters(): void {
    this.loadPaymentCountSection();
  }

  applyJournalFilters(): void {
    this.loadJournalSection();
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

  onMaintenanceBranchChange(value: number | ''): void {
    this.maintenanceBranchId.set(value === '' ? '' : Number(value));
  }

  onPaymentCountBranchChange(value: number | ''): void {
    this.paymentCountBranchId.set(value === '' ? '' : Number(value));
  }

  onJournalBranchChange(value: number | ''): void {
    this.journalBranchId.set(value === '' ? '' : Number(value));
  }

  formatMaintenanceCost(value: number): string {
    const lang = (this.translate.currentLang || 'en').toLowerCase();
    return new Intl.NumberFormat(lang.startsWith('ar') ? 'ar-SA' : 'en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value ?? 0);
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
    const branchId = this.vehicleBranchId() === '' ? null : Number(this.vehicleBranchId());
    const status = this.vehicleStatus();

    const list$ = status
      ? this.vehicleService.getList({
          fleetId,
          branchId,
          status,
        })
      : this.vehicleService.getListMergedAllStatuses({ fleetId, branchId });

    list$
      .pipe(finalize(() => this.vehicleLoading.set(false)))
      .subscribe({
        next: list => {
          const items = list ?? [];
          this.vehicleTotal.set(items.length);
          this.vehicleStatusCounts.set(this.aggregateVehiclesByStatus(items));
          this.vehicleByBranch.set(this.aggregateVehiclesByBranch(items));
          this.vehicleByYear.set(this.aggregateVehiclesByYear(items));
        },
        error: () => {
          this.vehicleError.set(true);
          this.vehicleStatusCounts.set([]);
          this.vehicleByBranch.set([]);
          this.vehicleByYear.set([]);
          this.vehicleTotal.set(0);
        },
      });
  }

  private loadBookingSection(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.bookingError.set(false);
      this.bookingStatusCounts.set([]);
      this.bookingByBranch.set([]);
      this.bookingByMonth.set([]);
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
          this.bookingByMonth.set(this.aggregateBookingsByMonth(list));
        },
        error: () => {
          this.bookingError.set(true);
          this.bookingStatusCounts.set([]);
          this.bookingByBranch.set([]);
          this.bookingByMonth.set([]);
        },
      });
  }

  private loadMaintenanceSection(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.maintenanceError.set(false);
      this.maintenanceStatusCounts.set([]);
      this.maintenanceByBranch.set([]);
      this.maintenanceByMonth.set([]);
      this.maintenanceTotal.set(0);
      this.maintenanceCostTotal.set(0);
      return;
    }

    this.maintenanceLoading.set(true);
    this.maintenanceError.set(false);
    const branchId = this.maintenanceBranchId() === '' ? null : Number(this.maintenanceBranchId());

    this.maintenanceService
      .getList({ fleetId, branchId })
      .pipe(finalize(() => this.maintenanceLoading.set(false)))
      .subscribe({
        next: list => {
          const items = list ?? [];
          this.maintenanceTotal.set(items.length);
          this.maintenanceCostTotal.set(
            items.reduce((sum, item) => sum + (Number(item.total) || 0), 0),
          );
          this.maintenanceStatusCounts.set(this.aggregateMaintenanceByStatus(items));
          this.maintenanceByBranch.set(this.aggregateMaintenanceByBranch(items));
          this.maintenanceByMonth.set(this.aggregateMaintenanceByMonth(items));
        },
        error: () => {
          this.maintenanceError.set(true);
          this.maintenanceStatusCounts.set([]);
          this.maintenanceByBranch.set([]);
          this.maintenanceByMonth.set([]);
          this.maintenanceTotal.set(0);
          this.maintenanceCostTotal.set(0);
        },
      });
  }

  private loadPaymentCountSection(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.paymentCountError.set(false);
      this.paymentCountByBondType.set([]);
      this.paymentCountByPaymentType.set([]);
      this.paymentCountByBranch.set([]);
      this.paymentCountTotal.set(0);
      this.paymentCountPaidTotal.set(0);
      return;
    }

    this.paymentCountLoading.set(true);
    this.paymentCountError.set(false);
    const branchRaw = this.paymentCountBranchId();
    const branchId = branchRaw === '' ? null : String(branchRaw);

    this.paymentCountService
      .getList(fleetId, branchId)
      .pipe(finalize(() => this.paymentCountLoading.set(false)))
      .subscribe({
        next: list => {
          const items = list ?? [];
          this.paymentCountTotal.set(items.length);
          this.paymentCountPaidTotal.set(
            items.reduce((sum, item) => sum + (Number(item.paid) || 0), 0),
          );
          this.paymentCountByBondType.set(this.aggregatePaymentCountsByBondType(items));
          this.paymentCountByPaymentType.set(this.aggregatePaymentCountsByPaymentType(items));
          this.paymentCountByBranch.set(this.aggregatePaymentCountsByBranch(items));
        },
        error: () => {
          this.paymentCountError.set(true);
          this.paymentCountByBondType.set([]);
          this.paymentCountByPaymentType.set([]);
          this.paymentCountByBranch.set([]);
          this.paymentCountTotal.set(0);
          this.paymentCountPaidTotal.set(0);
        },
      });
  }

  private loadJournalSection(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.journalError.set(false);
      this.journalByStatus.set([]);
      this.journalByType.set([]);
      this.journalByOperationType.set([]);
      this.journalTotal.set(0);
      this.journalDebitTotal.set(0);
      this.journalCreditTotal.set(0);
      return;
    }

    this.journalLoading.set(true);
    this.journalError.set(false);
    const branchRaw = this.journalBranchId();

    this.journalEntryService
      .getList(fleetId)
      .pipe(finalize(() => this.journalLoading.set(false)))
      .subscribe({
        next: list => {
          let items = list ?? [];
          if (branchRaw !== '') {
            const branchId = Number(branchRaw);
            items = items.filter(item => Number(item.idBranch) === branchId);
          }

          this.journalTotal.set(items.length);
          this.journalDebitTotal.set(
            items.reduce((sum, item) => sum + (Number(item.debtir) || 0), 0),
          );
          this.journalCreditTotal.set(
            items.reduce((sum, item) => sum + (Number(item.credit) || 0), 0),
          );
          this.journalByStatus.set(this.aggregateJournalsByStatus(items));
          this.journalByType.set(this.aggregateJournalsByType(items));
          this.journalByOperationType.set(this.aggregateJournalsByOperationType(items));
        },
        error: () => {
          this.journalError.set(true);
          this.journalByStatus.set([]);
          this.journalByType.set([]);
          this.journalByOperationType.set([]);
          this.journalTotal.set(0);
          this.journalDebitTotal.set(0);
          this.journalCreditTotal.set(0);
        },
      });
  }

  private loadTrafficViolationSection(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.trafficViolationError.set(false);
      this.trafficViolationByName.set([]);
      this.trafficViolationByVehicle.set([]);
      this.trafficViolationByBookingLink.set([]);
      this.trafficViolationByMonth.set([]);
      this.trafficViolationTotal.set(0);
      this.trafficViolationFineTotal.set(0);
      return;
    }

    this.trafficViolationLoading.set(true);
    this.trafficViolationError.set(false);

    this.trafficViolationService
      .getList(fleetId)
      .pipe(finalize(() => this.trafficViolationLoading.set(false)))
      .subscribe({
        next: list => {
          const items = list ?? [];
          this.trafficViolationTotal.set(items.length);
          this.trafficViolationFineTotal.set(
            items.reduce((sum, item) => sum + (Number(item.violationFine) || 0), 0),
          );
          this.trafficViolationByName.set(this.aggregateTrafficViolationsByName(items));
          this.trafficViolationByVehicle.set(this.aggregateTrafficViolationsByVehicle(items));
          this.trafficViolationByBookingLink.set(this.aggregateTrafficViolationsByBookingLink(items));
          this.trafficViolationByMonth.set(this.aggregateTrafficViolationsByMonth(items));
        },
        error: () => {
          this.trafficViolationError.set(true);
          this.trafficViolationByName.set([]);
          this.trafficViolationByVehicle.set([]);
          this.trafficViolationByBookingLink.set([]);
          this.trafficViolationByMonth.set([]);
          this.trafficViolationTotal.set(0);
          this.trafficViolationFineTotal.set(0);
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

  private aggregateVehiclesByStatus(items: Vehicle[]): { label: string; value: number }[] {
    const order: Vehicle['status'][] = ['Available', 'Booked', 'Maintenance', 'Inactive', 'Sold'];
    const map = new Map<Vehicle['status'], number>();
    for (const item of items) {
      const key = item.status ?? 'Available';
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return order
      .filter(key => (map.get(key) ?? 0) > 0)
      .map(key => ({ label: this.vehicleStatusLabel(key), value: map.get(key) ?? 0 }));
  }

  private aggregateVehiclesByBranch(items: Vehicle[]): { label: string; value: number }[] {
    return this.aggregateField(items, v => this.vehicleBranchLabel(v.branchId, v.branchName));
  }

  private aggregateVehiclesByYear(items: Vehicle[]): { label: string; value: number }[] {
    return this.aggregateField(items, v => String(v.yearMake ?? v.year ?? '').trim() || '—', 8);
  }

  private vehicleBranchLabel(branchId: number | null | undefined, branchName?: string | null): string {
    const named = String(branchName ?? '').trim();
    if (named) {
      return named;
    }
    if (branchId !== null && branchId !== undefined && Number(branchId) > 0) {
      const branch = this.branches().find(row => Number(row.id) === Number(branchId));
      if (branch) {
        return (branch.nameAr || branch.nameEn || `#${branchId}`).trim() || `#${branchId}`;
      }
      return `#${branchId}`;
    }
    return '—';
  }

  private vehicleStatusLabel(status: Vehicle['status']): string {
    if (status === 'Inactive') {
      return this.translate.instant('Dashboard vehicle status management');
    }
    if (status === 'Available') {
      return this.translate.instant('Dashboard vehicle status available');
    }
    if (status === 'Booked') {
      return this.translate.instant('Dashboard vehicle status booked');
    }
    if (status === 'Maintenance') {
      return this.translate.instant('Dashboard vehicle status maintenance');
    }
    if (status === 'Sold') {
      return this.translate.instant('Dashboard vehicle status sold');
    }
    return String(status ?? '—');
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

  private aggregateBookingsByMonth(items: Booking[]): { label: string; value: number }[] {
    return this.aggregateItemsByMonth(items, item => item.startDate);
  }

  private aggregateMaintenanceByBranch(items: Maintenance[]): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      const label = (item.branchName ?? '').trim() || (item.idBranch ? `#${item.idBranch}` : '—');
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private aggregateMaintenanceByStatus(items: Maintenance[]): { label: string; value: number }[] {
    const order = ['Pending', 'InProgress', 'Completed'];
    const map = new Map<string, number>();
    for (const item of items) {
      const key = this.normalizeMaintenanceStatusKey(item.status);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const ordered = order
      .filter(key => (map.get(key) ?? 0) > 0)
      .map(key => ({ label: this.maintenanceStatusLabel(key), value: map.get(key) ?? 0 }));

    const extras = [...map.entries()]
      .filter(([key]) => !order.includes(key))
      .map(([key, value]) => ({ label: this.maintenanceStatusLabel(key), value }));

    return [...ordered, ...extras];
  }

  private aggregateMaintenanceByMonth(items: Maintenance[]): { label: string; value: number }[] {
    return this.aggregateItemsByMonth(items, item => item.startDate);
  }

  private normalizeMaintenanceStatusKey(status: number | string): string {
    if (typeof status === 'string' && status.trim()) {
      const normalized = status.trim().toLowerCase().replace(/[\s_-]/g, '');
      if (normalized === 'pending') return 'Pending';
      if (normalized === 'inprogress') return 'InProgress';
      if (normalized === 'completed') return 'Completed';
      return status.trim();
    }

    const numeric = typeof status === 'number' ? status : Number(status);
    if (numeric === 0) return 'Pending';
    if (numeric === 1) return 'InProgress';
    if (numeric === 2) return 'Completed';
    return String(status ?? 'Unknown');
  }

  private maintenanceStatusLabel(key: string): string {
    const nameKey = `maintenance.statusName.${key}`;
    const named = this.translate.instant(nameKey);
    if (named !== nameKey) {
      return named;
    }

    const numeric = Number(key);
    if (Number.isFinite(numeric)) {
      const numKey = `maintenance.status.${numeric}`;
      const translated = this.translate.instant(numKey);
      if (translated !== numKey) {
        return translated;
      }
    }

    return key;
  }

  private aggregatePaymentCountsByBranch(items: PaymentCount[]): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      const label = (item.branchName ?? '').trim() || (item.idBranch ? `#${item.idBranch}` : '—');
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private aggregatePaymentCountsByBondType(items: PaymentCount[]): { label: string; value: number }[] {
    const order = [1, 2];
    const map = new Map<number, number>();
    for (const item of items) {
      const key = Number(item.bondType) || 0;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const ordered = order
      .filter(key => (map.get(key) ?? 0) > 0)
      .map(key => ({ label: this.paymentCountBondTypeLabel(key), value: map.get(key) ?? 0 }));

    const extras = [...map.entries()]
      .filter(([key]) => !order.includes(key) && key > 0)
      .map(([key, value]) => ({ label: this.paymentCountBondTypeLabel(key), value }));

    return [...ordered, ...extras];
  }

  private aggregatePaymentCountsByPaymentType(items: PaymentCount[]): { label: string; value: number }[] {
    const order = [1, 2, 3, 4, 5];
    const map = new Map<number, number>();
    for (const item of items) {
      const key = Number(item.paymentType) || 0;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const ordered = order
      .filter(key => (map.get(key) ?? 0) > 0)
      .map(key => ({ label: this.paymentCountPaymentTypeLabel(key), value: map.get(key) ?? 0 }));

    const extras = [...map.entries()]
      .filter(([key]) => !order.includes(key) && key > 0)
      .map(([key, value]) => ({ label: this.paymentCountPaymentTypeLabel(key), value }));

    return [...ordered, ...extras];
  }

  private paymentCountBondTypeLabel(bondType: number): string {
    if (bondType === 1) {
      return this.translate.instant('Payment Voucher');
    }
    if (bondType === 2) {
      return this.translate.instant('Receipt Voucher');
    }
    return this.translate.instant('Unknown');
  }

  private paymentCountPaymentTypeLabel(paymentType: number): string {
    switch (paymentType) {
      case 1:
        return this.translate.instant('Cash');
      case 2:
        return this.translate.instant('Network/POS');
      case 3:
        return this.translate.instant('Cheque');
      case 4:
        return this.translate.instant('Bank Transfer');
      case 5:
        return this.translate.instant('Bank/Cash');
      default:
        return this.translate.instant('Unknown');
    }
  }

  private aggregateJournalsByStatus(items: JournalEntry[]): { label: string; value: number }[] {
    const order = [1, 2];
    const map = new Map<number, number>();
    for (const item of items) {
      const key = Number(item.status) || 0;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const ordered = order
      .filter(key => (map.get(key) ?? 0) > 0)
      .map(key => ({ label: this.journalStatusLabel(key), value: map.get(key) ?? 0 }));

    const extras = [...map.entries()]
      .filter(([key]) => !order.includes(key) && key > 0)
      .map(([key, value]) => ({ label: this.journalStatusLabel(key), value }));

    return [...ordered, ...extras];
  }

  private aggregateJournalsByType(items: JournalEntry[]): { label: string; value: number }[] {
    const order = ['general', 'adjustment'];
    const map = new Map<string, number>();
    for (const item of items) {
      const key = this.normalizeJournalTypeKey(item.journalType);
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return order
      .filter(key => (map.get(key) ?? 0) > 0)
      .map(key => ({ label: this.journalTypeLabel(key), value: map.get(key) ?? 0 }));
  }

  private aggregateJournalsByOperationType(items: JournalEntry[]): { label: string; value: number }[] {
    const order = [1, 2, 3, 4, 5, 6];
    const map = new Map<number, number>();
    for (const item of items) {
      const key = Number(item.operationType) || 0;
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    const ordered = order
      .filter(key => (map.get(key) ?? 0) > 0)
      .map(key => ({ label: this.journalOperationTypeLabel(key), value: map.get(key) ?? 0 }));

    const extras = [...map.entries()]
      .filter(([key]) => !order.includes(key) && key > 0)
      .map(([key, value]) => ({ label: this.journalOperationTypeLabel(key), value }));

    return [...ordered, ...extras];
  }

  private normalizeJournalTypeKey(journalType?: number | boolean): string {
    if (journalType === true || journalType === 1) {
      return 'general';
    }
    if (journalType === false || journalType === 0) {
      return 'adjustment';
    }
    return 'unknown';
  }

  private journalStatusLabel(status: number): string {
    if (status === 1) {
      return this.translate.instant('Closed');
    }
    if (status === 2) {
      return this.translate.instant('Editable');
    }
    return this.translate.instant('Unknown');
  }

  private journalTypeLabel(key: string): string {
    if (key === 'general') {
      return this.translate.instant('General Journal');
    }
    if (key === 'adjustment') {
      return this.translate.instant('Adjustment Journal');
    }
    return this.translate.instant('Unknown');
  }

  private journalOperationTypeLabel(operationType: number): string {
    switch (operationType) {
      case 1:
        return this.translate.instant('Accounting Entry');
      case 2:
        return this.translate.instant('Receipt');
      case 3:
        return this.translate.instant('Payment Voucher');
      case 4:
        return this.translate.instant('Opening');
      case 5:
        return this.translate.instant('Expense Entry');
      case 6:
        return this.translate.instant('Accidents Recorded');
      default:
        return this.translate.instant('Unknown');
    }
  }

  private aggregateTrafficViolationsByName(items: TrafficViolation[]): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      const label = (item.nameViolation ?? '').trim() || '—';
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private aggregateTrafficViolationsByVehicle(items: TrafficViolation[]): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const item of items) {
      const label =
        (item.vehiclePlate ?? '').trim() ||
        (item.idVehicle ? `#${item.idVehicle}` : '—');
      map.set(label, (map.get(label) ?? 0) + 1);
    }
    return [...map.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }

  private aggregateTrafficViolationsByBookingLink(items: TrafficViolation[]): { label: string; value: number }[] {
    let withBooking = 0;
    let withoutBooking = 0;
    for (const item of items) {
      if (item.idBooking !== null && item.idBooking !== undefined && Number(item.idBooking) > 0) {
        withBooking += 1;
      } else {
        withoutBooking += 1;
      }
    }

    const rows: { label: string; value: number }[] = [];
    if (withBooking > 0) {
      rows.push({
        label: this.translate.instant('Dashboard ops traffic violation with booking'),
        value: withBooking,
      });
    }
    if (withoutBooking > 0) {
      rows.push({
        label: this.translate.instant('trafficViolations.bookingNone'),
        value: withoutBooking,
      });
    }
    return rows;
  }

  private aggregateTrafficViolationsByMonth(items: TrafficViolation[]): { label: string; value: number }[] {
    return this.aggregateItemsByMonth(items, item => item.dateViolation);
  }

  private aggregateItemsByMonth<T>(
    items: T[],
    dateAccessor: (item: T) => string | undefined,
    lastN = 8,
  ): { label: string; value: number }[] {
    const map = new Map<string, number>();
    const lang = (this.translate.currentLang || 'en').toLowerCase();
    const locale = lang.startsWith('ar') ? 'ar-SA' : 'en-US';

    for (const item of items) {
      const key = this.monthKeyFromDate(dateAccessor(item));
      if (!key) {
        continue;
      }
      map.set(key, (map.get(key) ?? 0) + 1);
    }

    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-lastN)
      .map(([key, value]) => ({
        label: this.formatMonthLabel(key, locale),
        value,
      }));
  }

  private monthKeyFromDate(value: string | undefined): string | null {
    if (!value?.trim()) {
      return null;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private formatMonthLabel(key: string, locale: string): string {
    const d = new Date(`${key}-01T12:00:00`);
    if (Number.isNaN(d.getTime())) {
      return key;
    }
    return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  }
}
