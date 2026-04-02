import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { TranslateModule } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { Booking, BookingStatus } from '../../../models';
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
  readonly statusFilterOptions: SmoothSelectOption[] = [
    { label: 'All statuses', value: '' },
    { label: 'Draft', value: 'Draft' },
    { label: 'Confirmed', value: 'Confirmed' },
    { label: 'Active', value: 'Active' },
    { label: 'Completed', value: 'Completed' },
    { label: 'Cancelled', value: 'Cancelled' },
  ];

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
        error: err => this.toast.error(err?.message ?? 'Failed to load bookings'),
        complete: () => this.loading.set(false),
      });
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
