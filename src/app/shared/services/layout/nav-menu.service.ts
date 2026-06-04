import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ADMIN_ROLES, APP_PRIVILEGES, TENANT_ADMIN_ROLES } from '../../../core/auth/access.constants';
import {
  FINANCE_MENU_ICONS,
  FINANCE_ROUTE_PATHS,
} from '../../../modules/finance/common/finance.constants';

export interface Menu {
  headTitle1?: string;
  level?: number;
  path?: string;
  title?: string;
  icon?: string;
  imageIcon?: string;
  type?: string;
  active?: boolean;
  id?: number;
  bookmark?: boolean;
  children?: Menu[];
  horizontalList?: boolean;
  items?: Menu[];
  roles?: string[];
  privileges?: string[];
  badge?: number;
}

@Injectable({
  providedIn: 'root',
})
export class NavMenuService {
  public isDisplay: boolean = false;
  public language: boolean = false;
  public isShow: boolean = false;
  public search!: boolean;

  MENUITEMS: Menu[] = [
    {
      level: 1,
      title: 'Dashboard',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/dashboard.png',
      type: 'sub',
      children: [
        {
          level: 2,
          path: '/dashboard',
          title: 'Dashboard',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/dashboard.png',
          type: 'link',
          bookmark: true,
        },
        {
          level: 2,
          path: '/dashboard/accounting',
          title: 'Accounting Dashboard',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/dashboard.png',
          type: 'link',
        },
      ],
    },
    {
      level: 1,
      title: 'Rental',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Booking.png',
      type: 'sub',
      children: [
        {
          level: 2,
          path: '/booking',
          title: 'Booking',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Booking.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.booking],
        },
        {
          level: 2,
          path: '/traffic-violations',
          title: 'trafficViolations.title',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Traffic-violations.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.booking, APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/customers',
          title: 'Customers',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Customers.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.customer],
        },
      ],
    },
    {
      level: 1,
      title: 'maintenance.menuTitle',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Maintenace.png',
      type: 'sub',
      privileges: [APP_PRIVILEGES.vehicle],
      children: [
        {
          level: 2,
          path: '/maintenance',
          title: 'maintenance.listTitle',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Maintenace.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/maintenance/insurance-companies',
          title: 'maintenance.insurance.listTitle',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/insurance.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/maintenance/spare-parts',
          title: 'maintenance.sparePart.listTitle',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/sparepart.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/maintenance/suppliers',
          title: 'maintenance.supplier.listTitle',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Supplier.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
      ],
    },
    {
      level: 1,
      title: 'Finance',
      icon: 'sample-page',
      imageIcon: FINANCE_MENU_ICONS.banks,
      type: 'sub',
      children: [
        {
          level: 2,
          path: `/${FINANCE_ROUTE_PATHS.banks}`,
          title: 'Banks',
          icon: 'sample-page',
          imageIcon: FINANCE_MENU_ICONS.banks,
          type: 'link',
        },
        {
          level: 2,
          path: `/${FINANCE_ROUTE_PATHS.cash}`,
          title: 'Cash Accounts',
          icon: 'sample-page',
          imageIcon: FINANCE_MENU_ICONS.cash,
          type: 'link',
        },
        {
          level: 2,
          path: `/${FINANCE_ROUTE_PATHS.counting}`,
          title: 'Chart of Accounts',
          icon: 'sample-page',
          imageIcon: FINANCE_MENU_ICONS.counting,
          type: 'link',
        },
        {
          level: 2,
          path: `/${FINANCE_ROUTE_PATHS.financialYears}`,
          title: 'Financial Years',
          icon: 'sample-page',
          imageIcon: FINANCE_MENU_ICONS.financialYears,
          type: 'link',
        },
        {
          level: 2,
          path: `/${FINANCE_ROUTE_PATHS.journals}`,
          title: 'Journals',
          icon: 'sample-page',
          imageIcon: FINANCE_MENU_ICONS.journals,
          type: 'link',
        },
        {
          level: 2,
          path: `/${FINANCE_ROUTE_PATHS.paymentCounts}`,
          title: 'Payment Counts',
          icon: 'sample-page',
          imageIcon: FINANCE_MENU_ICONS.paymentCounts,
          type: 'link',
        },
      ],
    },
    {
      level: 1,
      title: 'Management',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Vehicles.png',
      type: 'sub',
      children: [
        {
          level: 2,
          path: '/vehicles',
          title: 'Vehicles',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Vehicles.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/fleet',
          title: 'Fleet',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Fleet.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/branches',
          title: 'Branches',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Branches.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/category-vehicles',
          title: 'Category Vehicles',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Vehicle_Category.png',
          type: 'link',
          privileges: [APP_PRIVILEGES.vehicle],
        },
        {
          level: 2,
          path: '/settings',
          title: 'Settings',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Settings.png',
          type: 'link',
        },
        {
          level: 2,
          path: '/customer-subscriptions',
          title: 'Customer Subscriptions',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/subscription_customer.png',
          type: 'link',
          roles: TENANT_ADMIN_ROLES,
        },
      ],
    },
    {
      level: 1,
      title: 'Security',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Security.png',
      type: 'sub',
      roles: ADMIN_ROLES,
      children: [
        {
          level: 2,
          path: '/users',
          title: 'Users',
          type: 'link',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/users.png',
          roles: ADMIN_ROLES,
        },
        {
          level: 2,
          path: '/roles',
          title: 'Roles',
          type: 'link',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Roles.png',
          roles: ADMIN_ROLES,
        },
        {
          level: 2,
          path: '/privileges',
          title: 'Privileges',
          type: 'link',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/Privileges.png',
          roles: ADMIN_ROLES,
        },
        {
          level: 2,
          path: '/security',
          title: 'My Access',
          type: 'link',
          icon: 'sample-page',
          imageIcon: 'assets/images/rent_icon/My_Access.png',
          roles: ADMIN_ROLES,
        },
      ],
    },
  ];

  item = new BehaviorSubject<Menu[]>(this.MENUITEMS);
}
