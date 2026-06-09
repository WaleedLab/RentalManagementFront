import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';

import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { ConfirmService } from '../../../../shared/services/confirm.service';
import { ToastService } from '../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../shared/ui/empty-state/empty-state.component';
import { ListCommandBarComponent } from '../../../../shared/ui/list-command-bar/list-command-bar.component';
import { ListContentShellComponent } from '../../../../shared/ui/list-content-shell/list-content-shell.component';
import { ListSearchFieldComponent } from '../../../../shared/ui/list-search-field/list-search-field.component';
import { PaginationBarComponent } from '../../../../shared/ui/pagination-bar/pagination-bar.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
  SmoothSelectValue,
} from '../../../../shared/ui/smooth-select/smooth-select.component';
import { MaintenanceBranchOption } from '../../models/branch-reference.model';
import { Maintenance, MaintenanceStatus } from '../../models/maintenance.model';
import {
  MaintenanceAcceptDialogComponent,
  MaintenanceAcceptDialogResult,
} from '../maintenance-accept-dialog/maintenance-accept-dialog.component';
import {
  MaintenanceDetailsDialogComponent,
} from '../maintenance-details-dialog/maintenance-details-dialog.component';
import {
  MaintenanceFinishDialogComponent,
  MaintenanceFinishDialogResult,
} from '../maintenance-finish-dialog/maintenance-finish-dialog.component';
import { MaintenanceBranchService } from '../../services/maintenance-branch.service';
import { MaintenanceService } from '../../services/maintenance.service';

@Component({
  selector: 'app-maintenance-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    EmptyStateComponent,
    ListCommandBarComponent,
    ListSearchFieldComponent,
    ListContentShellComponent,
    PaginationBarComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './maintenance-list.component.html',
  styleUrl: './maintenance-list.component.scss',
})
export class MaintenanceListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private api = inject(MaintenanceService);
  private branchService = inject(MaintenanceBranchService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);
  private modal = inject(NgbModal);

  rows = signal<Maintenance[]>([]);
  branches = signal<MaintenanceBranchOption[]>([]);
  loading = signal(false);
  loadFailed = signal(false);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  status = signal<MaintenanceStatus | ''>('');
  branchId = signal<number | ''>('');
  orderBy = signal<'CreatedAt'>('CreatedAt');
  orderByDirection = signal<'ASC' | 'DESC'>('DESC');
  deletingIds = signal<string[]>([]);
  acceptingIds = signal<string[]>([]);
  finishingIds = signal<string[]>([]);
  private readonly languageTick = signal(0);
  private readonly statusValues: MaintenanceStatus[] = ['Pending', 'InProgress', 'Completed'];

  statusFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All statuses'), value: '' },
      ...this.statusValues.map(value => ({
        label: t(`maintenance.statusName.${value}`),
        value,
      })),
    ];
  });

  orderByOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [{ label: this.translate.instant('Created Date'), value: 'CreatedAt' }];
  });

  orderDirectionOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Descending'), value: 'DESC' },
      { label: this.translate.instant('Ascending'), value: 'ASC' },
    ];
  });

  branchFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('maintenance.allBranches'), value: '' },
      ...this.branches().map(branch => ({
        label: this.branchLabel(branch),
        value: Number(branch.id),
      })),
    ];
  });

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => {
      this.languageTick.update(v => v + 1);
    });
    this.loadBranches();
    this.load();
  }

  loadBranches(): void {
    const fleetId = this.authState.fleetId() || undefined;
    this.branchService.getList(fleetId).subscribe({
      next: branches => this.branches.set(branches),
      error: () => this.branches.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const rawBranchId = this.branchId();
    this.api
      .getPaginated({
        fleetId: this.authState.fleetId() ?? undefined,
        branchId: rawBranchId === '' ? null : Number(rawBranchId),
        search: this.search() || undefined,
        status: this.status() || undefined,
        orderBy: this.orderBy(),
        orderByDirection: this.orderByDirection(),
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
      })
      .subscribe({
        next: response => {
          this.rows.set(response.items ?? []);
          this.totalCount.set(response.totalCount ?? 0);
          this.totalPages.set(response.totalPages ?? 0);
        },
        error: err => {
          this.loadFailed.set(true);
          this.loading.set(false);
          this.toast.error(err?.message ?? this.translate.instant('maintenance.loadFailed'));
        },
        complete: () => this.loading.set(false),
      });
  }

  onSearch(): void {
    this.pageNumber.set(1);
    this.load();
  }

  onStatusChange(value: SmoothSelectValue): void {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      this.status.set('');
    } else if (this.statusValues.includes(normalized as MaintenanceStatus)) {
      this.status.set(normalized as MaintenanceStatus);
    } else {
      this.status.set('');
    }
    this.pageNumber.set(1);
    this.load();
  }

  onBranchChange(value: SmoothSelectValue): void {
    if (value === '' || value === null) {
      this.branchId.set('');
    } else {
      const parsed = Number(value);
      this.branchId.set(Number.isFinite(parsed) && parsed > 0 ? parsed : '');
    }
    this.pageNumber.set(1);
    this.load();
  }

  onOrderByChange(value: SmoothSelectValue): void {
    const normalized = String(value ?? '').trim();
    if (normalized === 'CreatedAt' && this.orderBy() !== normalized) {
      this.orderBy.set('CreatedAt');
      this.pageNumber.set(1);
      this.load();
    }
  }

  onOrderDirectionChange(value: SmoothSelectValue): void {
    const normalized = value === 'ASC' ? 'ASC' : 'DESC';
    if (this.orderByDirection() === normalized) {
      return;
    }
    this.orderByDirection.set(normalized);
    this.pageNumber.set(1);
    this.load();
  }

  changePageSize(size: number): void {
    if (size <= 0 || size === this.pageSize()) {
      return;
    }
    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages() || page === this.pageNumber()) {
      return;
    }
    this.pageNumber.set(page);
    this.load();
  }

  canAccept(row: Maintenance): boolean {
    return !row.isAcceptable;
  }

  isAccepting(id: string): boolean {
    return this.acceptingIds().includes(id);
  }

  canManageDetails(row: Maintenance): boolean {
    return this.isInProgress(row);
  }

  canFinish(row: Maintenance): boolean {
    return this.isInProgress(row);
  }

  isFinishing(id: string): boolean {
    return this.finishingIds().includes(id);
  }

  isInProgress(row: Maintenance): boolean {
    const status = row.status;
    if (status === 'InProgress' || status === 1) {
      return true;
    }
    if (typeof status === 'string' && status.trim().toLowerCase() === 'inprogress') {
      return true;
    }
    return false;
  }

  openDetailsDialog(row: Maintenance): void {
    const fleetId = this.authState.fleetId()?.trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const modalRef = this.modal.open(MaintenanceDetailsDialogComponent, {
      centered: true,
      size: 'lg',
      scrollable: true,
      windowClass: 'maintenance-details-modal',
    });

    const label = row.plateNumber || `#${row.id}`;
    modalRef.componentInstance.title = this.translate.instant('maintenance.details.title');
    modalRef.componentInstance.message = this.translate.instant('maintenance.details.message', {
      vehicle: label,
    });
    modalRef.componentInstance.plateNumber = label;
    modalRef.componentInstance.maintenanceId = row.id;
    modalRef.componentInstance.fleetId = fleetId;

    let changed = false;
    const dialog = modalRef.componentInstance as MaintenanceDetailsDialogComponent;
    dialog.result.subscribe(value => {
      if (value) {
        changed = true;
      }
    });
    modalRef.closed.subscribe(() => {
      if (changed) {
        this.load();
      }
    });
  }

  openAcceptDialog(row: Maintenance): void {
    const fleetId = this.authState.fleetId()?.trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const modalRef = this.modal.open(MaintenanceAcceptDialogComponent, {
      centered: true,
      windowClass: 'maintenance-accept-modal',
    });

    const label = row.plateNumber || `#${row.id}`;
    modalRef.componentInstance.title = this.translate.instant('maintenance.accept.title');
    modalRef.componentInstance.message = this.translate.instant('maintenance.accept.message', {
      vehicle: label,
    });
    modalRef.componentInstance.plateNumber = label;
    modalRef.componentInstance.maintenanceId = row.id;
    modalRef.componentInstance.fleetId = fleetId;

    const dialog = modalRef.componentInstance as MaintenanceAcceptDialogComponent;
    dialog.result.subscribe((payload: MaintenanceAcceptDialogResult) => {
      if (!payload) {
        return;
      }

      this.acceptingIds.update(ids => [...ids, row.id]);
      this.api.acceptable(payload).subscribe({
        next: () => {
          this.toast.success(this.translate.instant('maintenance.accept.success'));
          this.load();
        },
        error: err =>
          this.toast.error(err?.message ?? this.translate.instant('maintenance.accept.failed')),
        complete: () =>
          this.acceptingIds.update(ids => ids.filter(id => id !== row.id)),
      });
    });
  }

  openFinishDialog(row: Maintenance): void {
    const fleetId = this.authState.fleetId()?.trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const modalRef = this.modal.open(MaintenanceFinishDialogComponent, {
      centered: true,
      windowClass: 'maintenance-finish-modal',
    });

    const label = row.plateNumber || `#${row.id}`;
    modalRef.componentInstance.title = this.translate.instant('maintenance.finish.title');
    modalRef.componentInstance.message = this.translate.instant('maintenance.finish.message', {
      vehicle: label,
    });
    modalRef.componentInstance.plateNumber = label;
    modalRef.componentInstance.maintenanceId = row.id;
    modalRef.componentInstance.fleetId = fleetId;

    const dialog = modalRef.componentInstance as MaintenanceFinishDialogComponent;
    dialog.result.subscribe((payload: MaintenanceFinishDialogResult) => {
      if (!payload) {
        return;
      }

      this.finishingIds.update(ids => [...ids, row.id]);
      this.api.finish(payload).subscribe({
        next: () => {
          this.toast.success(this.translate.instant('maintenance.finish.success'));
          this.load();
        },
        error: err =>
          this.toast.error(err?.message ?? this.translate.instant('maintenance.finish.failed')),
        complete: () =>
          this.finishingIds.update(ids => ids.filter(id => id !== row.id)),
      });
    });
  }

  deleteRow(row: Maintenance): void {
    const fleetId = this.authState.fleetId()?.trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const label = row.plateNumber || `#${row.id}`;
    this.confirm
      .confirm(
        this.translate.instant('maintenance.deleteTitle'),
        `${this.translate.instant('maintenance.deleteConfirm')} ${label}`,
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.deletingIds.update(ids => [...ids, row.id]);
        this.api.softDelete(row.id, fleetId).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('maintenance.deleteSuccess'));
            this.load();
          },
          error: err =>
            this.toast.error(err?.message ?? this.translate.instant('maintenance.deleteFailed')),
          complete: () =>
            this.deletingIds.update(ids => ids.filter(id => id !== row.id)),
        });
      });
  }

  formatMoney(value: number | null | undefined): string {
    const amount = value ?? 0;
    return new Intl.NumberFormat(this.getLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  formatDate(value: string | undefined): string {
    if (!value?.trim()) {
      return '-';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString(this.getLocale(), { dateStyle: 'short', timeStyle: 'short' });
  }

  branchLabel(branch: MaintenanceBranchOption): string {
    return this.isArabicUi()
      ? branch.nameAr || branch.nameEn || String(branch.id)
      : branch.nameEn || branch.nameAr || String(branch.id);
  }

  statusBadgeClass(status: number | string | unknown): string {
    return `maintenance-status-badge maintenance-status-badge--${this.resolveStatusTone(status)}`;
  }

  private resolveStatusTone(
    status: number | string | unknown,
  ): 'pending' | 'in-progress' | 'completed' | 'unknown' {
    if (typeof status === 'string' && status.trim()) {
      const normalized = status.trim().toLowerCase().replace(/[\s_-]/g, '');
      if (normalized === 'pending') {
        return 'pending';
      }
      if (normalized === 'inprogress') {
        return 'in-progress';
      }
      if (normalized === 'completed') {
        return 'completed';
      }
    }

    const numeric = typeof status === 'number' ? status : Number(status);
    if (Number.isFinite(numeric)) {
      if (numeric === 0) {
        return 'pending';
      }
      if (numeric === 1) {
        return 'in-progress';
      }
      if (numeric === 2) {
        return 'completed';
      }
    }

    return 'unknown';
  }

  statusLabel(status: number | string | unknown): string {
    if (typeof status === 'string' && status.trim()) {
      const nameKey = `maintenance.statusName.${status}`;
      const named = this.translate.instant(nameKey);
      if (named !== nameKey) {
        return named;
      }
    }

    const numeric = typeof status === 'number' ? status : Number(status);
    if (Number.isFinite(numeric)) {
      const key = `maintenance.status.${numeric}`;
      const translated = this.translate.instant(key);
      if (translated !== key) {
        return translated;
      }
    }

    return String(status ?? '-');
  }

  isDeleting(id: string): boolean {
    return this.deletingIds().includes(id);
  }

  private isArabicUi(): boolean {
    const lang = (
      this.translate.currentLang ||
      this.translate.getDefaultLang() ||
      'en'
    ).toLowerCase();
    return lang.startsWith('ar');
  }

  private getLocale(): string {
    return this.isArabicUi() ? 'ar-SA' : 'en-US';
  }
}
