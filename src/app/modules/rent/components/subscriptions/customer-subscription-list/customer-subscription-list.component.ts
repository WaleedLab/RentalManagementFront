import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { TENANT_ADMIN_ROLES } from '../../../../../core/auth/access.constants';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { CustomerSubscription } from '../../../models/subscriptions/customer-subscription.model';
import { CustomerSubscriptionService } from '../../../services/subscriptions/customer-subscription.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';

@Component({
  selector: 'app-customer-subscription-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    EmptyStateComponent,
    PageHeaderComponent,
    PaginationBarComponent,
  ],
  templateUrl: './customer-subscription-list.component.html',
  styleUrl: './customer-subscription-list.component.scss',
})
export class CustomerSubscriptionListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private subscriptionService = inject(CustomerSubscriptionService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  subscriptions = signal<CustomerSubscription[]>([]);
  search = signal('');
  pageNumber = signal(1);
  pageSize = signal(10);
  totalCount = signal(0);
  totalPages = signal(1);
  loading = signal(false);
  canManage = computed(() => this.authState.hasAnyRole(TENANT_ADMIN_ROLES));
  currentPage = computed(() => this.pageNumber());

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.subscriptions.set([]);
      this.totalCount.set(0);
      this.totalPages.set(1);
      return;
    }

    this.loading.set(true);
    this.subscriptionService.getPaginated({
      fleetId,
      pageNumber: this.pageNumber(),
      pageSize: this.pageSize(),
      search: this.search().trim() || undefined,
      orderByDirection: 'DESC',
      orderBy: 'CreatedAt',
    }).subscribe({
      next: response => {
        this.subscriptions.set(response.items ?? []);
        this.totalCount.set(response.totalCount ?? 0);
        this.totalPages.set(Math.max(1, response.totalPages ?? 1));
        this.pageNumber.set(response.pageNumber || this.pageNumber());
      },
      error: err =>
        this.toast.error(
          err?.message ?? this.translate.instant('Failed to load subscription offers'),
        ),
      complete: () => this.loading.set(false),
    });
  }

  onSearchSubmit(): void {
    this.search.set(this.search().trim());
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

  changePageSize(size: number): void {
    if (size <= 0 || size === this.pageSize()) {
      return;
    }

    this.pageSize.set(size);
    this.pageNumber.set(1);
    this.load();
  }

  getSubscriptionName(subscription: CustomerSubscription): string {
    const lang = (
      this.translate.currentLang ||
      this.translate.getDefaultLang() ||
      'en'
    ).toLowerCase();

    if (lang.startsWith('ar')) {
      return subscription.nameAr || subscription.nameEn || '-';
    }

    return subscription.nameEn || subscription.nameAr || '-';
  }
}
