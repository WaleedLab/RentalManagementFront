import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { FINANCE_ROUTE_PATHS } from './common/finance.constants';
import { APP_PRIVILEGES } from '../../core/auth/access.constants';
import { authGuard } from '../../shared/services/auth/auth.guard';
import { privilegeGuard } from '../../shared/services/auth/privilege.guard';

const routes: Routes = [
  {
    path: `${FINANCE_ROUTE_PATHS.banks}/create`,
    loadComponent: () =>
      import('./components/banks/bank-form/bank-form.component').then(m => m.BankFormComponent),
    data: {
      title: 'Create Bank',
      breadcrumb: 'Create Bank',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: FINANCE_ROUTE_PATHS.banks,
    loadComponent: () =>
      import('./components/banks/bank-list/bank-list.component').then(m => m.BankListComponent),
    data: {
      title: 'Banks',
      breadcrumb: 'Banks',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: `${FINANCE_ROUTE_PATHS.cash}/create`,
    loadComponent: () =>
      import('./components/cash/cash-account-form/cash-account-form.component').then(
        m => m.CashAccountFormComponent,
      ),
    data: {
      title: 'Create Cash Account',
      breadcrumb: 'Create Cash Account',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: FINANCE_ROUTE_PATHS.cash,
    loadComponent: () =>
      import('./components/cash/cash-account-list/cash-account-list.component').then(
        m => m.CashAccountListComponent,
      ),
    data: {
      title: 'Cash Accounts',
      breadcrumb: 'Cash Accounts',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: `${FINANCE_ROUTE_PATHS.counting}/create`,
    loadComponent: () =>
      import('./components/counting/counting-entry-form/counting-entry-form.component').then(
        m => m.CountingEntryFormComponent,
      ),
    data: {
      title: 'Create Counting Entry',
      breadcrumb: 'Create Counting Entry',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: FINANCE_ROUTE_PATHS.counting,
    loadComponent: () =>
      import('./components/counting/counting-entry-list/counting-entry-list.component').then(
        m => m.CountingEntryListComponent,
      ),
    data: {
      title: 'Chart of Accounts',
      breadcrumb: 'Chart of Accounts',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: `${FINANCE_ROUTE_PATHS.financialYears}/create`,
    loadComponent: () =>
      import('./components/financial-years/financial-year-form/financial-year-form.component').then(
        m => m.FinancialYearFormComponent,
      ),
    data: {
      title: 'Create Financial Year',
      breadcrumb: 'Create Financial Year',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: FINANCE_ROUTE_PATHS.financialYears,
    loadComponent: () =>
      import('./components/financial-years/financial-year-list/financial-year-list.component').then(
        m => m.FinancialYearListComponent,
      ),
    data: {
      title: 'Financial Years',
      breadcrumb: 'Financial Years',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: `${FINANCE_ROUTE_PATHS.journals}/create`,
    loadComponent: () =>
      import('./components/journals/journal-entry-form/journal-entry-form.component').then(
        m => m.JournalEntryFormComponent,
      ),
    data: {
      title: 'Create Journal Entry',
      breadcrumb: 'Create Journal Entry',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: FINANCE_ROUTE_PATHS.journals,
    loadComponent: () =>
      import('./components/journals/journal-entry-list/journal-entry-list.component').then(
        m => m.JournalEntryListComponent,
      ),
    data: {
      title: 'Journals',
      breadcrumb: 'Journals',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: `${FINANCE_ROUTE_PATHS.paymentCounts}/create`,
    loadComponent: () =>
      import('./components/payment-counts/payment-count-form/payment-count-form.component').then(
        m => m.PaymentCountFormComponent,
      ),
    data: {
      title: 'Create Payment Count',
      breadcrumb: 'Create Payment Count',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
  {
    path: FINANCE_ROUTE_PATHS.paymentCounts,
    loadComponent: () =>
      import('./components/payment-counts/payment-count-list/payment-count-list.component').then(
        m => m.PaymentCountListComponent,
      ),
    data: {
      title: 'Payment Counts',
      breadcrumb: 'Payment Counts',
      privileges: [APP_PRIVILEGES.financialReports],
    },
    canActivate: [authGuard, privilegeGuard],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class FinanceRoutingModule {}
