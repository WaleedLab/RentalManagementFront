import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { ListCommandBarComponent } from '../../../../../shared/ui/list-command-bar/list-command-bar.component';
import { ListContentShellComponent } from '../../../../../shared/ui/list-content-shell/list-content-shell.component';
import { ListSearchFieldComponent } from '../../../../../shared/ui/list-search-field/list-search-field.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { Branch } from '../../../models';
import { Maintenance } from '../../../models/maintenance/maintenance.model';
import { BranchService } from '../../../services/branches/branch.service';
import { MaintenanceService } from '../../../services/maintenance/maintenance.service';

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
  ],
  templateUrl: './maintenance-list.component.html',
  styleUrl: './maintenance-list.component.scss',
})
export class MaintenanceListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private api = inject(MaintenanceService);
  private branchService = inject(BranchService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);

  rows = signal<Maintenance[]>([]);
  branches = signal<Branch[]>([]);
  loading = signal(false);
  loadFailed = signal(false);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  branchId = signal<number | null>(null);
  deletingIds = signal<string[]>([]);

  ngOnInit(): void {
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
    this.api
      .getPaginated({
        fleetId: this.authState.fleetId() ?? undefined,
        branchId: this.branchId(),
        search: this.search() || undefined,
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

  onBranchChange(value: string): void {
    const parsed = value === '' ? null : Number(value);
    this.branchId.set(parsed !== null && Number.isFinite(parsed) && parsed > 0 ? parsed : null);
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

  branchLabel(branch: Branch): string {
    return this.isArabicUi()
      ? branch.nameAr || branch.nameEn || String(branch.id)
      : branch.nameEn || branch.nameAr || String(branch.id);
  }

  statusLabel(status: number): string {
    const key = `maintenance.status.${status}`;
    const translated = this.translate.instant(key);
    return translated !== key ? translated : String(status);
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
