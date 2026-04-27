import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { normalizeApiError } from '../../../../../core/api/api-response.utils';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { Booking, BookingStatus, Branch } from '../../../models';
import {
  bookingStatusTranslationKey,
  getBookingStatusTheme,
} from '../../../models/booking/booking-status.utils';
import {
  BookingService,
  BookingStatusCountItem,
  BookingStatusCountsPeriod,
} from '../../../services/booking/booking.service';
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
  ],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent implements OnInit {
  private static readonly DEFAULT_PAGE_SIZE = 10;

  private bookingService = inject(BookingService);
  private branchService = inject(BranchService);
  private authState = inject(AuthStateService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  bookings = signal<Booking[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(BookingListComponent.DEFAULT_PAGE_SIZE);
  loading = signal(false);
  search = signal('');
  status = signal<BookingStatus | ''>('');
  branches = signal<Branch[]>([]);
  branchId = signal<number | ''>('');
  countsPeriod = signal<BookingStatusCountsPeriod>('ThisMonth');
  bookingStatusCounts = signal<BookingStatusCountItem[]>([]);
  bookingStatusTotalCount = signal(0);
  private readonly statusValues: BookingStatus[] = [
    'open',
    'finsh',
    'Suspended_due_to_accident',
    'translate',
    'close',
    'extension',
    'Suspended_due_to_sum_money',
    'Unknown',
  ];
  statusFilterOptions = computed<SmoothSelectOption[]>(() => {
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All statuses'), value: '' },
      ...this.statusValues.map(status => ({ label: t(bookingStatusTranslationKey(status)), value: status })),
    ];
  });
  branchFilterOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('All branches'), value: '' },
    ...this.branches().map(branch => ({
      label: this.getBranchOptionLabel(branch),
      value: Number(branch.id),
    })),
  ]);
  countsPeriodOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('This Month'), value: 'ThisMonth' },
    { label: this.translate.instant('Last 3 Months'), value: 'Last3Months' },
    { label: this.translate.instant('This Year'), value: 'ThisYear' },
  ]);
  readonly bookingLegendItems = computed(() => {
    const items = this.statusValues.map(status => {
      const theme = getBookingStatusTheme(status);
      const matchedCount =
        this.bookingStatusCounts().find(item =>
          (item.status ?? '').toLowerCase() === status.toLowerCase() ||
          (item.includedStatuses ?? []).some(included => included.toLowerCase() === status.toLowerCase()),
        )?.count ?? 0;
      return {
        key: status,
        count: matchedCount,
        labelAr: theme.labelAr,
        labelEn: theme.labelEn,
        color: theme.chartColor,
        iconClass: theme.iconClass,
      };
    });

    return [
      {
        key: 'total',
        count: this.bookingStatusTotalCount(),
        labelAr: 'الإجمالي',
        labelEn: 'Total',
        color: '#2563EB',
        iconClass: 'fa-solid fa-list-check',
      },
      ...items,
    ];
  });

  getBookingStatusIconClass(status: BookingStatus): string {
    return getBookingStatusTheme(status).iconClass;
  }

  getBookingLegendLabel(item: { labelAr: string; labelEn: string }): string {
    return this.isArabicUi() ? item.labelAr : item.labelEn;
  }

  getBookingStatusBadgeStyle(status: BookingStatus): Record<string, string> {
    const theme = getBookingStatusTheme(status);
    return {
      background: theme.gradient,
      color: theme.textColor,
      borderColor: theme.borderLight,
    };
  }

  getBookingCardStyle(status: BookingStatus): Record<string, string> {
    const theme = getBookingStatusTheme(status);
    return {
      '--booking-status-bg-light': theme.bgLight,
      '--booking-status-bg-dark': theme.bgDark,
      '--booking-status-border-light': theme.borderLight,
      '--booking-status-border-dark': theme.borderDark,
      '--booking-status-accent': theme.color,
      '--booking-status-gradient': theme.gradient,
    };
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

  canFinishBooking(booking: Booking): boolean {
    return booking.status !== 'finsh' && booking.status !== 'close';
  }

  onCardAction(
    action: 'edit' | 'suspend' | 'cancel' | 'extend' | 'pay' | 'print' | 'finish',
    booking: Booking,
  ): void {
    if (action === 'finish' && !this.canFinishBooking(booking)) {
      return;
    }
    const actionLabels: Record<typeof action, string> = {
      edit: 'تعديل',
      suspend: 'تعليق',
      cancel: 'إلغاء',
      extend: 'تمديد',
      pay: 'دفع',
      print: 'طباعة',
      finish: 'إنهاء',
    };
    this.toast.info(`${actionLabels[action]}: ${this.translate.instant('Details')}`);
    this.router.navigate(['/booking', booking.id, 'details'], {
      queryParams: { action },
    });
  }

  updateCustomerTooltip(container: HTMLElement, booking: Booking): void {
    const valueEl = container.querySelector('.booking-meta__value') as HTMLElement | null;
    if (!valueEl) {
      container.removeAttribute('data-tooltip');
      return;
    }
    const isTruncated = valueEl.scrollWidth > valueEl.clientWidth;
    if (!isTruncated) {
      container.removeAttribute('data-tooltip');
      return;
    }
    container.setAttribute('data-tooltip', this.customerCardLabel(booking));
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
    this.loadStatusCounts();
    this.load();
  }

  onSearchSubmit(): void {
    this.pageNumber.set(1);
    this.load();
  }

  onStatusFilterChange(value: BookingStatus | ''): void {
    this.status.set(value);
    if (!value) {
      // Reset mode: All statuses.
      this.pageNumber.set(1);
      this.pageSize.set(BookingListComponent.DEFAULT_PAGE_SIZE);
    } else {
      this.pageNumber.set(1);
    }
    this.loadStatusCounts();
    this.load();
  }

  onBranchFilterChange(value: number | ''): void {
    this.branchId.set(value);
    if (!value) {
      // Reset mode: All branches.
      this.pageNumber.set(1);
      this.pageSize.set(BookingListComponent.DEFAULT_PAGE_SIZE);
    } else {
      this.pageNumber.set(1);
    }
    this.loadStatusCounts();
    this.load();
  }

  onCountsPeriodChange(value: BookingStatusCountsPeriod): void {
    this.countsPeriod.set(value);
    this.loadStatusCounts();
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
          this.bookings.set(this.sortBookingsForStableDisplay(page.items ?? []));
          this.totalCount.set(page.totalCount ?? page.items?.length ?? 0);
          this.totalPages.set(page.totalPages ?? 0);
          this.pageNumber.set(page.pageNumber ?? this.pageNumber());
        },
        error: err => {
          this.toast.error(this.bookingListLoadErrorMessage(err));
        },
        complete: () => this.loading.set(false),
      });
  }

  private loadStatusCounts(): void {
    const fleetId = this.authState.fleetId() || undefined;
    this.bookingService
      .getStatusCounts({
        fleetId,
        branchId: Number(this.branchId() || 0) || undefined,
        period: this.countsPeriod(),
      })
      .subscribe({
        next: response => {
          this.bookingStatusCounts.set(response.statusCounts ?? []);
          this.bookingStatusTotalCount.set(response.totalCount ?? 0);
          if (!this.search().trim() && !this.status()) {
            this.totalCount.set(response.totalCount ?? 0);
          }
        },
        error: () => {
          this.bookingStatusCounts.set([]);
          this.bookingStatusTotalCount.set(0);
        },
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

  private sortBookingsForStableDisplay(items: Booking[]): Booking[] {
    return [...items].sort((a, b) => {
      const aDate = new Date(a.createdAt ?? '').getTime();
      const bDate = new Date(b.createdAt ?? '').getTime();
      const safeADate = Number.isFinite(aDate) ? aDate : 0;
      const safeBDate = Number.isFinite(bDate) ? bDate : 0;
      if (safeADate !== safeBDate) {
        return safeBDate - safeADate; // default UI order is DESC by created date
      }

      const idA = Number(a.id);
      const idB = Number(b.id);
      if (Number.isFinite(idA) && Number.isFinite(idB) && idA !== idB) {
        return idB - idA;
      }

      return String(b.id).localeCompare(String(a.id));
    });
  }
}
