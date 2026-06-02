import { CommonModule } from '@angular/common';
import { Component, Input, inject } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './page-header.component.html',
  styleUrl: './page-header.component.scss',
})
export class PageHeaderComponent {
  private router = inject(Router);

  @Input() title = '';
  @Input() subtitle = '';
  @Input() icon = '';

  get iconSrc(): string {
    if (this.icon.trim()) {
      return this.icon;
    }

    const url = this.router.url.toLowerCase().split('?')[0];

    if (url.includes('/users')) return 'assets/images/rent_icon/users.png';
    if (url.includes('/roles')) return 'assets/images/rent_icon/Roles.png';
    if (url.includes('/privileges')) return 'assets/images/rent_icon/Privileges.png';
    if (url.includes('/security')) return 'assets/images/rent_icon/My_Access.png';

    if (url.includes('/booking')) return 'assets/images/rent_icon/Booking.png';
    if (url.includes('/traffic-violations')) return 'assets/images/rent_icon/Traffic-violations.png';
    if (url.includes('/maintenance/spare-parts')) return 'assets/images/rent_icon/sparepart.png';
    if (url.includes('/maintenance/suppliers')) return 'assets/images/rent_icon/Supplier.png';
    if (url.includes('/maintenance/insurance-companies')) return 'assets/images/rent_icon/insurance.png';
    if (url.includes('/maintenance')) return 'assets/images/rent_icon/Maintenace.png';
    if (url.includes('/customer-subscriptions')) return 'assets/images/rent_icon/subscription_customer.png';
    if (url.includes('/customers')) return 'assets/images/rent_icon/Customers.png';
    if (url.includes('/vehicles')) return 'assets/images/rent_icon/Vehicles.png';
    if (url.includes('/fleet')) return 'assets/images/rent_icon/Fleet.png';
    if (url.includes('/branches')) return 'assets/images/rent_icon/Branches.png';
    if (url.includes('/category-vehicles')) return 'assets/images/rent_icon/Vehicle_Category.png';
    if (url.includes('/settings')) return 'assets/images/rent_icon/Settings.png';

    if (url.includes('/banks')) return 'assets/images/Finance/bank.png';
    if (url.includes('/cash')) return 'assets/images/Finance/Cash Accounts.png';
    if (url.includes('/counting')) return 'assets/images/Finance/Chart of Accounts.png';
    if (url.includes('/financial-years')) return 'assets/images/Finance/Financial Years.png';
    if (url.includes('/journals')) return 'assets/images/Finance/journal entries.png';
    if (url.includes('/payment-counts')) return 'assets/images/Finance/Payment Counts.png';

    if (url.includes('/dashboard')) return 'assets/images/rent_icon/dashboard.png';

    return 'assets/images/rent_icon/home.png';
  }
}
