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
  loading = signal(false);
  canManage = computed(() => this.authState.hasAnyRole(TENANT_ADMIN_ROLES));

  filteredSubscriptions = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    if (!keyword) {
      return this.subscriptions();
    }

    return this.subscriptions().filter(subscription => {
      const searchableText = [
        subscription.nameAr,
        subscription.nameEn,
        subscription.description,
        String(subscription.discount),
        String(subscription.subscriptionApprovedAfter),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(keyword);
    });
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.subscriptions.set([]);
      return;
    }

    this.loading.set(true);
    this.subscriptionService.getList(fleetId).subscribe({
      next: list => this.subscriptions.set(list ?? []),
      error: err =>
        this.toast.error(
          err?.message ?? this.translate.instant('Failed to load subscription offers'),
        ),
      complete: () => this.loading.set(false),
    });
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
