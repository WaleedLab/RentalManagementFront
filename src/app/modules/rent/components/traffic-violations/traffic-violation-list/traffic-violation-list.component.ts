import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { TrafficViolation } from '../../../models/traffic-violations/traffic-violation.model';
import { TrafficViolationService } from '../../../services/traffic-violations/traffic-violation.service';

@Component({
  selector: 'app-traffic-violation-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginationBarComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './traffic-violation-list.component.html',
  styleUrl: './traffic-violation-list.component.scss',
})
export class TrafficViolationListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private api = inject(TrafficViolationService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private confirm = inject(ConfirmService);

  rows = signal<TrafficViolation[]>([]);
  loading = signal(false);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(10);
  search = signal('');
  deletingIds = signal<string[]>([]);

  readonly pageSizeFilterOptions: SmoothSelectOption[] = [
    { label: '5', value: 5 },
    { label: '10', value: 10 },
    { label: '25', value: 25 },
  ];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getPaginated({
        fleetId: this.authState.fleetId() ?? undefined,
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
          this.toast.error(err?.message ?? this.translate.instant('trafficViolations.loadFailed'));
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  onSearch(): void {
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

  deleteRow(row: TrafficViolation): void {
    const fleetId = this.authState.fleetId()?.trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const label = row.nameViolation || `#${row.id}`;
    this.confirm
      .confirm(
        this.translate.instant('trafficViolations.deleteTitle'),
        `${this.translate.instant('trafficViolations.deleteConfirm')} ${label}`,
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.deletingIds.update(ids => [...ids, row.id]);
        this.api.softDelete(row.id, fleetId).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('trafficViolations.deleteSuccess'));
            this.load();
          },
          error: err =>
            this.toast.error(err?.message ?? this.translate.instant('trafficViolations.deleteFailed')),
          complete: () =>
            this.deletingIds.update(ids => ids.filter(id => id !== row.id)),
        });
      });
  }

  formatMoney(value: number): string {
    return new Intl.NumberFormat(this.getLocale(), {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  }

  formatDate(value: string): string {
    if (!value?.trim()) {
      return '-';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return value;
    }
    return d.toLocaleString(this.getLocale(), { dateStyle: 'short', timeStyle: 'short' });
  }

  bookingCell(row: TrafficViolation): string {
    if (row.bookingLabel) {
      return row.bookingLabel;
    }
    if (row.idBooking != null && row.idBooking > 0) {
      return String(row.idBooking);
    }
    return '-';
  }

  vehicleCell(row: TrafficViolation): string {
    if (row.vehiclePlate) {
      return row.vehiclePlate;
    }
    return String(row.idVehicle);
  }

  isDeleting(id: string): boolean {
    return this.deletingIds().includes(id);
  }

  private getLocale(): string {
    const lang = (
      this.translate.currentLang ||
      this.translate.getDefaultLang() ||
      'en'
    ).toLowerCase();
    return lang.startsWith('ar') ? 'ar-SA' : 'en-US';
  }
}
