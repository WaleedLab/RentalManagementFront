import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { normalizeApiError } from '../../../../../core/api/api-response.utils';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { Booking, BookingStatus, Branch } from '../../../models';
import { bookingStatusTone, bookingStatusTranslationKey } from '../../../models/booking/booking-status.utils';
import { BookingService } from '../../../services/booking/booking.service';
import { BranchService } from '../../../services/branches/branch.service';

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    PageHeaderComponent,
    PaginationBarComponent,
    EmptyStateComponent,
    SmoothSelectComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent implements OnInit {
  private bookingService = inject(BookingService);
  private branchService = inject(BranchService);
  private authState = inject(AuthStateService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  bookings = signal<Booking[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(12);
  loading = signal(false);
  search = signal('');
  status = signal<BookingStatus | ''>('');
  branches = signal<Branch[]>([]);
  branchId = signal<number | ''>('');
  statusFilterOptions = computed<SmoothSelectOption[]>(() => {
    const t = (key: string) => this.translate.instant(key);
    const values: BookingStatus[] = [
      'open',
      'finsh',
      'Suspended_due_to_accident',
      'translate',
      'close',
      'extension',
      'Suspended_due_to_sum_money',
      'Payment_on_account',
      'Unknown',
    ];
    return [
      { label: t('All statuses'), value: '' },
      ...values.map(status => ({ label: t(bookingStatusTranslationKey(status)), value: status })),
    ];
  });
  branchFilterOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('All branches'), value: '' },
    ...this.branches().map(branch => ({
      label: this.getBranchOptionLabel(branch),
      value: Number(branch.id),
    })),
  ]);

  statusBadgeTone(status: BookingStatus): 'success' | 'warning' | 'danger' | 'secondary' | 'info' {
    return bookingStatusTone(status);
  }

  statusBadgeLabelKey(status: BookingStatus): string {
    return bookingStatusTranslationKey(status);
  }

  statusBadgeLabel(booking: Booking): string {
    const fromApi = (booking.statusDisplayName ?? '').trim();
    if (fromApi) {
      return fromApi;
    }
    return this.translate.instant(this.statusBadgeLabelKey(booking.status));
  }

  customerCardLabel(booking: Booking): string {
    const name = (booking.customerName ?? '').trim();
    if (name) {
      return name;
    }
    return booking.customerId ? `#${booking.customerId}` : '—';
  }

  vehicleCardLabel(booking: Booking): string {
    const name = (booking.vehicleName ?? '').trim();
    const plate = (booking.vehiclePlateNumber ?? '').trim();
    const serial = (booking.vehicleSerialNumber ?? '').trim();
    if (name && plate && name.toLowerCase() === plate.toLowerCase() && serial) {
      return serial;
    }
    if (name) {
      return name;
    }
    if (plate) {
      return plate;
    }
    if (serial) {
      return serial;
    }
    return booking.vehicleId ? `#${booking.vehicleId}` : '—';
  }

  vehicleSerialLabel(booking: Booking): string {
    const serial = (booking.vehicleSerialNumber ?? '').trim();
    if (serial) {
      return serial;
    }
    return booking.vehicleId ? `#${booking.vehicleId}` : '—';
  }

  branchCardLabel(booking: Booking): string {
    const branch = (booking.branchName ?? '').trim();
    if (branch) {
      return branch;
    }
    return booking.branchId ? `#${booking.branchId}` : '—';
  }

  bookingCardStatusClass(status: BookingStatus): string {
    if (status === 'finsh' || status === 'close') {
      return 'booking-card--status-success';
    }
    if (status === 'Suspended_due_to_accident' || status === 'Suspended_due_to_sum_money') {
      return 'booking-card--status-warning';
    }
    if (status === 'open' || status === 'extension' || status === 'translate') {
      return 'booking-card--status-info';
    }
    return 'booking-card--status-neutral';
  }

  onBookingImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (!img) {
      return;
    }
    img.style.display = 'none';
    const fallback = img.nextElementSibling as HTMLElement | null;
    if (fallback) {
      fallback.classList.remove('booking-card__media-not-found--hidden');
    }
  }

  getBookingTitle(booking: Booking): string {
    const n = (booking.bookingNumber ?? '').trim();
    return n || String(booking.id);
  }

  bookingNumberLabel(booking: Booking): string {
    const number = (booking.bookingNumber ?? '').trim();
    if (number) {
      return number;
    }
    return String(booking.id ?? '').trim() || '—';
  }

  bookingBasameNumberLabel(booking: Booking): string {
    const basameNumber = (booking.numberBookingINBasame ?? '').trim();
    if (basameNumber) {
      return basameNumber;
    }
    return '—';
  }

  expectedStartDateLabel(booking: Booking): string {
    return this.formatBookingDate(booking.startDate);
  }

  expectedEndDateLabel(booking: Booking): string {
    return this.formatBookingDate(booking.endDate);
  }

  private formatBookingDate(iso: string | undefined): string {
    if (!iso?.trim()) {
      return '—';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return iso;
    }
    return d.toLocaleDateString(this.translate.currentLang || this.translate.getDefaultLang() || 'en', {
      year: '2-digit',
      month: 'numeric',
      day: 'numeric',
    });
  }

  ngOnInit(): void {
    this.loadBranches();
    this.load();
  }

  onSearchSubmit(): void {
    this.pageNumber.set(1);
    this.load();
  }

  onStatusFilterChange(value: BookingStatus | ''): void {
    this.status.set(value);
    this.onSearchSubmit();
  }

  onBranchFilterChange(value: number | ''): void {
    this.branchId.set(value);
    this.onSearchSubmit();
  }

  formatBookingTotal(value: number | null | undefined): string {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return new Intl.NumberFormat(this.translate.currentLang || this.translate.getDefaultLang() || 'en', {
      maximumFractionDigits: 2,
    }).format(n);
  }

  load(): void {
    this.loading.set(true);
    const fleetId = this.authState.fleetId() || undefined;
    this.bookingService
      .getPaginated({
        fleetId,
        branchId: Number(this.branchId() || 0) || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        status: this.status(),
        orderBy: 'CreatedAt',
        orderByDirection: 'DESC',
      })
      .subscribe({
        next: page => {
          this.bookings.set(page.items ?? []);
          this.totalCount.set(page.totalCount ?? page.items?.length ?? 0);
          this.totalPages.set(page.totalPages ?? 0);
          this.pageNumber.set(page.pageNumber ?? this.pageNumber());
          this.pageSize.set(page.pageSize ?? this.pageSize());
        },
        error: err => {
          this.toast.error(this.bookingListLoadErrorMessage(err));
        },
        complete: () => this.loading.set(false),
      });
  }

  /** Paginated requests use `suppressErrorToast`; surface ProblemDetails / validation text here. */
  private bookingListLoadErrorMessage(err: unknown): string {
    if (err instanceof HttpErrorResponse) {
      const normalized = normalizeApiError(err);
      if (normalized.message && normalized.message !== err.message) {
        return normalized.message;
      }
      const body = err.error;
      if (body && typeof body === 'object') {
        const o = body as Record<string, unknown>;
        const title = typeof o['title'] === 'string' ? o['title'].trim() : '';
        const detail = typeof o['detail'] === 'string' ? o['detail'].trim() : '';
        if (title || detail) {
          return `${title}${title && detail ? ': ' : ''}${detail}`.trim();
        }
        const errs = o['errors'];
        if (errs && typeof errs === 'object' && !Array.isArray(errs)) {
          const joined = Object.values(errs as Record<string, unknown[]>)
            .flat()
            .map(x => String(x))
            .filter(Boolean)
            .join(' ');
          if (joined) {
            return joined.slice(0, 800);
          }
        }
      }
      return normalized.message;
    }
    return err instanceof Error ? err.message : this.translate.instant('Failed to load bookings');
  }

  goToPage(page: number): void {
    if (page < 1 || page === this.pageNumber()) {
      return;
    }

    this.pageNumber.set(page);
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

  private loadBranches(): void {
    const fleetId = this.authState.fleetId() || undefined;
    this.branchService
      .getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 500,
        search: undefined,
      })
      .subscribe({
        next: page => this.branches.set(page.items ?? []),
        error: () => this.branches.set([]),
      });
  }

  private getBranchOptionLabel(branch: Branch): string {
    return this.isArabicUi()
      ? branch.nameAr || branch.nameEn || '-'
      : branch.nameEn || branch.nameAr || '-';
  }

  private isArabicUi(): boolean {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar');
  }
}
