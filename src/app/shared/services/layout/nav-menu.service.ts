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
    { headTitle1: 'Dashboard' },
    {
      level: 1,
      path: '/dashboard',
      title: 'Dashboard',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/dashboard.png',
      type: 'link',
      bookmark: true,
    },
    {
      level: 1,
      path: '/dashboard/accounting',
      title: 'Accounting Dashboard',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Payment_Counts.png',
      type: 'link',
    },
    { headTitle1: 'Operations' },
    {
      level: 1,
      path: '/booking',
      title: 'Booking',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Booking.png',
      type: 'link',
      privileges: [APP_PRIVILEGES.booking],
    },
    {
      level: 1,
      path: '/customers',
      title: 'Customers',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Customers.png',
      type: 'link',
      privileges: [APP_PRIVILEGES.customer],
    },
    {
      level: 1,
      path: '/customer-subscriptions',
      title: 'Customer Subscriptions',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/subscription_customer.png',
      type: 'link',
      roles: TENANT_ADMIN_ROLES,
    },
    { headTitle1: 'Finance' },
    {
      level: 1,
      path: `/${FINANCE_ROUTE_PATHS.banks}`,
      title: 'Banks',
      icon: 'sample-page',
      imageIcon: FINANCE_MENU_ICONS.banks,
      type: 'link',
    },
    {
      level: 1,
      path: `/${FINANCE_ROUTE_PATHS.cash}`,
      title: 'Cash Accounts',
      icon: 'sample-page',
      imageIcon: FINANCE_MENU_ICONS.cash,
      type: 'link',
    },
    {
      level: 1,
      path: `/${FINANCE_ROUTE_PATHS.counting}`,
      title: 'Chart of Accounts',
      icon: 'sample-page',
      imageIcon: FINANCE_MENU_ICONS.counting,
      type: 'link',
    },
    {
      level: 1,
      path: `/${FINANCE_ROUTE_PATHS.financialYears}`,
      title: 'Financial Years',
      icon: 'sample-page',
      imageIcon: FINANCE_MENU_ICONS.financialYears,
      type: 'link',
    },
    {
      level: 1,
      path: `/${FINANCE_ROUTE_PATHS.journals}`,
      title: 'Journals',
      icon: 'sample-page',
      imageIcon: FINANCE_MENU_ICONS.journals,
      type: 'link',
    },
    {
      level: 1,
      path: `/${FINANCE_ROUTE_PATHS.paymentCounts}`,
      title: 'Payment Counts',
      icon: 'sample-page',
      imageIcon: FINANCE_MENU_ICONS.paymentCounts,
      type: 'link',
    },
    { headTitle1: 'Management' },
    {
      level: 1,
      path: '/vehicles',
      title: 'Vehicles',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Vehicles.png',
      type: 'link',
      privileges: [APP_PRIVILEGES.vehicle],
    },
    {
      level: 1,
      path: '/fleet',
      title: 'Fleet',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Fleet.png',
      type: 'link',
      privileges: [APP_PRIVILEGES.vehicle],
    },
    {
      level: 1,
      path: '/branches',
      title: 'Branches',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Branches.png',
      type: 'link',
      privileges: [APP_PRIVILEGES.vehicle],
    },
    {
      level: 1,
      path: '/category-vehicles',
      title: 'Category Vehicles',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Vehicle_Category.png',
      type: 'link',
      privileges: [APP_PRIVILEGES.vehicle],
    },
    {
      level: 1,
      path: '/settings',
      title: 'Settings',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Settings.png',
      type: 'link',
    },
    { headTitle1: 'Security' },
    {
      level: 1,
      title: 'Security',
      icon: 'sample-page',
      imageIcon: 'assets/images/rent_icon/Security.png',
      type: 'sub',
      roles: ADMIN_ROLES,
      children: [
        { path: '/users', title: 'Users', type: 'link', icon: 'sample-page', imageIcon: 'assets/images/rent_icon/users.png', roles: ADMIN_ROLES },
        { path: '/roles', title: 'Roles', type: 'link', icon: 'sample-page', imageIcon: 'assets/images/rent_icon/Roles.png', roles: ADMIN_ROLES },
        { path: '/privileges', title: 'Privileges', type: 'link', icon: 'sample-page', imageIcon: 'assets/images/rent_icon/Privileges.png', roles: ADMIN_ROLES },
        { path: '/security', title: 'My Access', type: 'link', icon: 'sample-page', imageIcon: 'assets/images/rent_icon/My_Access.png', roles: ADMIN_ROLES },
      ],
    },
  ];

  item = new BehaviorSubject<Menu[]>(this.MENUITEMS);
}
