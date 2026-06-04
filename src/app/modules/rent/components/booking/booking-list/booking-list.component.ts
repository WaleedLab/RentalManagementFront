import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { normalizeApiError } from '../../../../../core/api/api-response.utils';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { ListCommandBarComponent } from '../../../../../shared/ui/list-command-bar/list-command-bar.component';
import { ListContentShellComponent } from '../../../../../shared/ui/list-content-shell/list-content-shell.component';
import { ListSearchFieldComponent } from '../../../../../shared/ui/list-search-field/list-search-field.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { VehicleSaudiPlateComponent } from '../../../../../shared/ui/vehicle-saudi-plate/vehicle-saudi-plate.component';
import { Booking, BookingStatus, Branch, VEHICLE_FALLBACK_IMAGE } from '../../../models';
import {
  bookingStatusTranslationKey,
  getBookingListCardStatusClass,
  getBookingListColorGuideItems,
  getBookingStatusBadgeStyle as buildBookingStatusBadgeStyle,
  getBookingStatusTheme,
} from '../../../models/booking/booking-status.utils';
import { BookingService } from '../../../services/booking/booking.service';
import { BranchService } from '../../../services/branches/branch.service';
import { buildBookingTrackingQueryParams } from '../../../utils/booking-tracking-params.util';
import {
  bookingCardActionInMain,
  bookingCardCloseInMenu,
  bookingCardEditInMenu,
  bookingCardFinishInMenu,
  bookingCardMoreMenuVisible,
  bookingCardPrintInMenu,
  bookingCardTrackInMenu,
  bookingFinishActionClass,
  bookingFinishLabelKey,
  bookingFinishRoute,
  canBookingCloseAction,
  canBookingEditAction,
  canBookingExtendAction,
  canBookingFinishAction,
  canBookingSuspendAction,
} from '../booking-card-actions.util';

@Component({
  selector: 'app-booking-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    ListCommandBarComponent,
    ListContentShellComponent,
    PaginationBarComponent,
    EmptyStateComponent,
    ListSearchFieldComponent,
    SmoothSelectComponent,
    VehicleSaudiPlateComponent,
  ],
  templateUrl: './booking-list.component.html',
  styleUrl: './booking-list.component.scss',
})
export class BookingListComponent implements OnInit {
  private static readonly DEFAULT_PAGE_SIZE = 10;
  private readonly vehicleFallbackImage = VEHICLE_FALLBACK_IMAGE;

  private bookingService = inject(BookingService);
  private branchService = inject(BranchService);
  private authState = inject(AuthStateService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  bookings = signal<Booking[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(BookingListComponent.DEFAULT_PAGE_SIZE);
  loading = signal(false);
  loadFailed = signal(false);
  search = signal('');
  status = signal<BookingStatus | ''>('');
  branches = signal<Branch[]>([]);
  branchId = signal<number | ''>('');
  orderBy = signal('CreatedAt');
  orderByDirection = signal<'ASC' | 'DESC'>('DESC');
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
  orderByOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Created Date'), value: 'CreatedAt' },
    { label: this.translate.instant('Start Date'), value: 'StartDate' },
    { label: this.translate.instant('End Date'), value: 'EndDate' },
    { label: this.translate.instant('Total'), value: 'TOTAL' },
  ]);
  orderDirectionOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Descending'), value: 'DESC' },
    { label: this.translate.instant('Ascending'), value: 'ASC' },
  ]);
  private langTick = signal(0);

  colorGuide = computed(() => {
    this.langTick();
    return getBookingListColorGuideItems(this.translate.currentLang || 'ar');
  });

  pageSubtitle = computed(() => {
    this.langTick();
    return this.translate.instant('Bookings page subtitle');
  });

  getBookingListCardStatusClass = getBookingListCardStatusClass;

  getBookingStatusIconClass(status: BookingStatus): string {
    return getBookingStatusTheme(status).iconClass;
  }

  getBookingStatusBadgeStyle(status: BookingStatus): Record<string, string> {
    return buildBookingStatusBadgeStyle(status);
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

  bookingVehicleImage(booking: Booking): string {
    const resolved = resolveMediaUrl(booking.vehicleImageUrl);
    return resolved || this.vehicleFallbackImage;
  }

  onBookingVehicleImageError(event: Event): void {
    const target = event.target as HTMLImageElement | null;
    if (target && target.getAttribute('src') !== this.vehicleFallbackImage) {
      target.setAttribute('src', this.vehicleFallbackImage);
    }
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

  canCloseAction = canBookingCloseAction;
  canEditAction = canBookingEditAction;
  canFinishAction = canBookingFinishAction;
  canSuspendAction = canBookingSuspendAction;
  canExtendAction = canBookingExtendAction;
  cardActionInMain = bookingCardActionInMain;
  cardFinishRoute = bookingFinishRoute;
  cardFinishLabelKey = bookingFinishLabelKey;
  cardFinishActionClass = bookingFinishActionClass;
  cardTrackInMenu = bookingCardTrackInMenu;
  cardEditInMenu = bookingCardEditInMenu;

  bookingTrackQueryParams(booking: Booking): Record<string, string> {
    return buildBookingTrackingQueryParams(booking);
  }
  cardCloseInMenu = bookingCardCloseInMenu;
  cardFinishInMenu = bookingCardFinishInMenu;
  cardMoreMenuVisible = bookingCardMoreMenuVisible;
  cardPrintInMenu = bookingCardPrintInMenu;

  contractCardLabel(booking: Booking): string {
    const number = (booking.bookingNumber ?? '').trim();
    if (number) {
      return number;
    }
    const basame = (booking.numberBookingINBasame ?? '').trim();
    if (basame) {
      return basame;
    }
    return String(booking.id ?? '').trim() || '—';
  }

  formatBookingDate(value: string | undefined): string {
    const raw = (value ?? '').trim();
    if (!raw) {
      return '—';
    }
    const date = new Date(raw);
    if (!Number.isFinite(date.getTime())) {
      return raw;
    }
    const lang = this.translate.currentLang || this.translate.getDefaultLang() || 'ar';
    return new Intl.DateTimeFormat(lang, { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  }

  endDateHighlightClass(booking: Booking): string {
    const state = this.bookingEndDateState(booking);
    if (state === 'overdue') {
      return 'booking-card__date--overdue';
    }
    if (state === 'today') {
      return 'booking-card__date--today';
    }
    return '';
  }

  endDateBadgeKey(booking: Booking): string | null {
    const state = this.bookingEndDateState(booking);
    if (state === 'overdue') {
      return 'Booking return overdue';
    }
    if (state === 'today') {
      return 'Booking return today';
    }
    return null;
  }

  private bookingEndDateState(booking: Booking): 'overdue' | 'today' | 'upcoming' | 'none' {
    const status = String(booking.status ?? '').trim();
    if (status === 'close' || status === 'finsh') {
      return 'none';
    }
    const end = this.parseDateOnly(booking.endDate);
    if (!end) {
      return 'none';
    }
    const today = this.startOfLocalDay(new Date());
    const endDay = this.startOfLocalDay(end);
    if (endDay.getTime() < today.getTime()) {
      return 'overdue';
    }
    if (endDay.getTime() === today.getTime()) {
      return 'today';
    }
    return 'upcoming';
  }

  private parseDateOnly(value: string | undefined): Date | null {
    const raw = (value ?? '').trim();
    if (!raw) {
      return null;
    }
    const date = new Date(raw);
    return Number.isFinite(date.getTime()) ? date : null;
  }

  private startOfLocalDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  closeBookingCardMore(panel: HTMLDetailsElement | null): void {
    if (panel) {
      panel.open = false;
    }
  }

  ngOnInit(): void {
    this.translate.onLangChange.subscribe(() => this.langTick.update(v => v + 1));
    this.loadBranches();
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
    this.load();
  }

  onOrderByChange(value: string): void {
    const normalized = (value ?? '').trim() || 'CreatedAt';
    if (this.orderBy() === normalized) {
      return;
    }
    this.orderBy.set(normalized);
    this.pageNumber.set(1);
    this.load();
  }

  onOrderDirectionChange(value: 'ASC' | 'DESC'): void {
    const normalized: 'ASC' | 'DESC' = value === 'ASC' ? 'ASC' : 'DESC';
    if (this.orderByDirection() === normalized) {
      return;
    }
    this.orderByDirection.set(normalized);
    this.pageNumber.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadFailed.set(false);
    const fleetId = this.authState.fleetId() || undefined;
    this.bookingService
      .getPaginated({
        fleetId,
        branchId: Number(this.branchId() || 0) || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        status: this.status(),
        orderBy: this.orderBy(),
        orderByDirection: this.orderByDirection(),
      })
      .subscribe({
        next: page => {
          this.bookings.set(this.sortBookingsForStableDisplay(page.items ?? []));
          this.totalCount.set(page.totalCount ?? page.items?.length ?? 0);
          this.totalPages.set(page.totalPages ?? 0);
          this.pageNumber.set(page.pageNumber ?? this.pageNumber());
        },
        error: err => {
          this.loadFailed.set(true);
          this.loading.set(false);
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
