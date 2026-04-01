import { CommonModule } from '@angular/common';
import { Component, computed, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { TENANT_ADMIN_ROLES } from '../../../../../core/auth/access.constants';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { Customer } from '../../../models';
import { CustomerSubscription } from '../../../models/subscriptions/customer-subscription.model';
import { CustomerService } from '../../../services/customers/customer.service';
import { CustomerSubscriptionService } from '../../../services/subscriptions/customer-subscription.service';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';

type CustomerSearchField =
  | 'all'
  | 'subscription'
  | 'nameAr'
  | 'phone'
  | 'licenseExpiry'
  | 'identity'
  | 'license'
  | 'birthDate';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.scss',
})
export class CustomerListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private customerService = inject(CustomerService);
  private customerSubscriptionService = inject(CustomerSubscriptionService);
  private confirm = inject(ConfirmService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  customers = signal<Customer[]>([]);
  customerSubscriptions = signal<CustomerSubscription[]>([]);
  canManageSubscriptions = computed(() => this.authState.hasAnyRole(TENANT_ADMIN_ROLES));
  search = signal('');
  searchField = signal<CustomerSearchField>('all');
  loading = signal(false);
  searchFieldOptions: Array<{ value: CustomerSearchField; label: string }> = [
    { value: 'all', label: 'All Fields' },
    { value: 'subscription', label: 'Subscription' },
    { value: 'nameAr', label: 'Arabic Name' },
    { value: 'phone', label: 'Phone' },
    { value: 'licenseExpiry', label: 'License Expiry' },
    { value: 'identity', label: 'Identity' },
    { value: 'license', label: 'License' },
    { value: 'birthDate', label: 'Birth Date' },
  ];
  filteredCustomers = computed(() => {
    const keyword = this.search().trim().toLowerCase();
    if (!keyword) {
      return this.customers();
    }

    return this.customers().filter(customer => this.matchesSearch(customer, keyword));
  });

  ngOnInit(): void {
    this.loadSubscriptions();
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.customerService
      .getPaginated({
        fleetId: this.authState.fleetId() || undefined,
        pageNumber: 1,
        pageSize: 500,
        search: undefined,
        isActive: '',
      })
      .subscribe({
        next: page => this.customers.set(page.items ?? []),
        error: err => this.toast.error(err?.message ?? this.translate.instant('Failed to load customers')),
        complete: () => this.loading.set(false),
      });
  }

  loadSubscriptions(): void {
    this.customerSubscriptionService
      .getList(this.authState.fleetId() || undefined)
      .subscribe({
        next: subscriptions => this.customerSubscriptions.set(subscriptions ?? []),
        error: () => this.customerSubscriptions.set([]),
      });
  }

  onSearchSubmit(): void {
    this.search.set(this.search().trim());
  }

  deleteCustomer(customer: Customer): void {
    const customerName = this.getArabicName(customer);
    this.confirm
      .confirm(
        this.translate.instant('Delete Customer'),
        `${this.translate.instant('Are you sure you want to delete this customer?')} ${customerName}`,
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }

        this.customerService.softDelete(customer.id).subscribe({
          next: () => {
            this.toast.success(this.translate.instant('Customer deleted successfully'));
            this.customers.update(items => items.filter(item => item.id !== customer.id));
          },
          error: err =>
            this.toast.error(err?.message ?? this.translate.instant('Failed to delete customer')),
        });
      });
  }

  getSubscriptionName(customer: Customer): string {
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

    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    if (lang.startsWith('ar')) {
      return matchedSubscription.nameAr || matchedSubscription.nameEn || '-';
    }

    return matchedSubscription.nameEn || matchedSubscription.nameAr || '-';
  }

  getArabicName(customer: Customer): string {
    return customer.nameAr || customer.fullName || '-';
  }

  getPhone(customer: Customer): string {
    return customer.phoneNumber || customer.firstMobileNumber || '-';
  }

  getLicenseExpiry(customer: Customer): string {
    const dateValue =
      customer.dateDrivinglicenseHajri || customer.drivingLicenseExpiryDate || customer.dateDrivinglicense;
    return this.formatDateValue(dateValue);
  }

  getIdentity(customer: Customer): string {
    return customer.identityNumber || customer.idNationality || '-';
  }

  getLicense(customer: Customer): string {
    return customer.drivingLicenseNumber || customer.licenceNo || '-';
  }

  getBirthDate(customer: Customer): string {
    return this.formatDateValue(customer.dateOfBirth || customer.birthDay);
  }

  private matchesSearch(customer: Customer, keyword: string): boolean {
    const field = this.searchField();
    if (field === 'all') {
      const searchableFields: CustomerSearchField[] = [
        'subscription',
        'nameAr',
        'phone',
        'licenseExpiry',
        'identity',
        'license',
        'birthDate',
      ];

      return searchableFields.some(searchableField =>
        this.getSearchFieldValue(customer, searchableField).includes(keyword),
      );
    }

    return this.getSearchFieldValue(customer, field).includes(keyword);
  }

  private getSearchFieldValue(customer: Customer, field: CustomerSearchField): string {
    switch (field) {
      case 'subscription':
        return this.getSubscriptionName(customer).toLowerCase();
      case 'nameAr':
        return this.getArabicName(customer).toLowerCase();
      case 'phone':
        return this.getPhone(customer).toLowerCase();
      case 'licenseExpiry':
        return this.getLicenseExpiry(customer).toLowerCase();
      case 'identity':
        return this.getIdentity(customer).toLowerCase();
      case 'license':
        return this.getLicense(customer).toLowerCase();
      case 'birthDate':
        return this.getBirthDate(customer).toLowerCase();
      default:
        return '';
    }
  }

  private formatDateValue(value?: string): string {
    if (!value) {
      return '-';
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return '-';
    }

    if (normalized.includes('T')) {
      return normalized.split('T')[0].replace(/-/g, '/');
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      return normalized.replace(/-/g, '/');
    }

    return normalized;
  }
}






