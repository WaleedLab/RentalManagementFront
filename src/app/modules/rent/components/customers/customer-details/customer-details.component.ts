import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { FieldValueStateDirective } from '../../../../../shared/directives/field-value-state.directive';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';
import { Customer } from '../../../models';
import { CustomerSubscription } from '../../../models/subscriptions/customer-subscription.model';
import { CustomerService } from '../../../services/customers/customer.service';
import { CustomerSubscriptionService } from '../../../services/subscriptions/customer-subscription.service';

@Component({
  selector: 'app-customer-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    FieldValueStateDirective,
    PageHeaderComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './customer-details.component.html',
  styleUrl: './customer-details.component.scss',
})
export class CustomerDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authState = inject(AuthStateService);
  private customerService = inject(CustomerService);
  private customerSubscriptionService = inject(CustomerSubscriptionService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  customer = signal<Customer | null>(null);
  customerSubscriptions = signal<CustomerSubscription[]>([]);
  loading = signal(false);

  ngOnInit(): void {
    this.loadSubscriptions();

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.loading.set(true);
    this.customerService.getById(id, this.authState.fleetId() ?? '').subscribe({
      next: customer => this.customer.set(customer),
      error: err =>
        this.toast.error(err?.message || this.translate.instant('Failed to load customer')),
      complete: () => this.loading.set(false),
    });
  }

  imageUrl(): string | null {
    return resolveMediaUrl(this.customer()?.imageUrl);
  }

  display(value?: string | number | null): string {
    if (value === null || value === undefined) {
      return '-';
    }

    const normalized = String(value).trim();
    return normalized ? normalized : '-';
  }

  formatDate(value?: string | null): string {
    const normalized = this.display(value);
    if (normalized === '-') {
      return normalized;
    }

    if (normalized.includes('T')) {
      return normalized.split('T')[0].replace(/-/g, '/');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized.replace(/-/g, '/');
    }

    return normalized;
  }

  getSubscriptionName(): string {
    const customer = this.customer();
    if (!customer) {
      return '-';
    }

    const subscriptionId = Number(customer.idSubscriptionsOfCustomer ?? 0);
    if (!subscriptionId) {
      return '-';
    }

    const matchedSubscription = this.customerSubscriptions().find(
      subscription => Number(subscription.id) === subscriptionId,
    );
    if (!matchedSubscription) {
      return '-';
    }

    const lang = (
      this.translate.currentLang ||
      this.translate.getDefaultLang() ||
      'en'
    ).toLowerCase();

    if (lang.startsWith('ar')) {
      return matchedSubscription.nameAr || matchedSubscription.nameEn || '-';
    }

    return matchedSubscription.nameEn || matchedSubscription.nameAr || '-';
  }

  private loadSubscriptions(): void {
    this.customerSubscriptionService.getList(this.authState.fleetId() || undefined).subscribe({
      next: subscriptions => this.customerSubscriptions.set(subscriptions ?? []),
      error: () => this.customerSubscriptions.set([]),
    });
  }
}
