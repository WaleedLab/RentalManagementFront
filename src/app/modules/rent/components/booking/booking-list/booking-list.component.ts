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
import { Booking, BookingStatus } from '../../../models';
import { bookingStatusTone, bookingStatusTranslationKey } from '../../../models/booking/booking-status.utils';
import { BookingService } from '../../../services/booking/booking.service';

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
  private authState = inject(AuthStateService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  bookings = signal<Booking[]>([]);
  totalCount = signal(0);
  totalPages = signal(0);
  pageNumber = signal(1);
  pageSize = signal(20);
  loading = signal(false);
  search = signal('');
  status = signal<BookingStatus | ''>('');
  dateFrom = signal('');
  dateTo = signal('');
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

  statusBadgeTone(status: BookingStatus): 'success' | 'warning' | 'danger' | 'secondary' | 'info' {
    return bookingStatusTone(status);
  }

  statusBadgeLabelKey(status: BookingStatus): string {
    return bookingStatusTranslationKey(status);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.bookingService
      .getPaginated({
        fleetId: this.authState.fleetId() || undefined,
        pageNumber: this.pageNumber(),
        pageSize: this.pageSize(),
        search: this.search() || undefined,
        status: this.status(),
        startDate: this.dateFrom() || undefined,
        endDate: this.dateTo() || undefined,
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
}
