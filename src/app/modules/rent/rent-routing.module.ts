import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { ADMIN_ROLES, APP_PRIVILEGES, TENANT_ADMIN_ROLES } from '../../core/auth/access.constants';
import { authGuard } from '../../shared/services/auth/auth.guard';
import { privilegeGuard } from '../../shared/services/auth/privilege.guard';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () => import('./components/dashboard/dashboard/dashboard.component').then(m => m.DashboardComponent),
    data: { title: 'Dashboard', breadcrumb: 'Dashboard' },
    canActivate: [authGuard],
  },
  {
    path: 'users',
    data: { title: 'Users', breadcrumb: 'Users', roles: ADMIN_ROLES },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/users/user-list/user-list.component').then(m => m.UserListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/users/user-form/user-form.component').then(m => m.UserFormComponent),
      },
      {
        path: 'edit/:id',
        loadComponent: () => import('./components/users/user-form/user-form.component').then(m => m.UserFormComponent),
      },
      {
        path: ':id/privileges',
        loadComponent: () => import('./components/users/user-privileges/user-privileges.component').then(m => m.UserPrivilegesComponent),
        data: { title: 'User Privileges', breadcrumb: 'Privileges' },
      },
    ],
  },
  {
    path: 'roles',
    data: { title: 'Roles', breadcrumb: 'Roles', roles: ADMIN_ROLES },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/roles/role-list/role-list.component').then(m => m.RoleListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/roles/role-form/role-form.component').then(m => m.RoleFormComponent),
      },
      {
        path: 'edit/:id',
        loadComponent: () => import('./components/roles/role-form/role-form.component').then(m => m.RoleFormComponent),
      },
    ],
  },
  {
    path: 'privileges',
    data: { title: 'Privileges', breadcrumb: 'Privileges', roles: ADMIN_ROLES },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/privileges/privilege-list/privilege-list.component').then(m => m.PrivilegeListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/privileges/privilege-form/privilege-form.component').then(m => m.PrivilegeFormComponent),
      },
      {
        path: 'edit/:id',
        loadComponent: () => import('./components/privileges/privilege-form/privilege-form.component').then(m => m.PrivilegeFormComponent),
      },
    ],
  },
  {
    path: 'fleet',
    data: { title: 'Fleet', breadcrumb: 'Fleet', privileges: [APP_PRIVILEGES.vehicle] },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/fleet/fleet-list/fleet-list.component').then(m => m.FleetListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/fleet/fleet-form/fleet-form.component').then(m => m.FleetFormComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./components/fleet/fleet-form/fleet-form.component').then(m => m.FleetFormComponent),
      },
    ],
  },
  {
    path: 'branches',
    data: { title: 'Branches', breadcrumb: 'Branches', privileges: [APP_PRIVILEGES.vehicle] },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/branches/branch-list/branch-list.component').then(m => m.BranchListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/branches/branch-form/branch-form.component').then(m => m.BranchFormComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./components/branches/branch-form/branch-form.component').then(m => m.BranchFormComponent),
      },
    ],
  },
  {
    path: 'vehicles',
    data: { title: 'Vehicles', breadcrumb: 'Vehicles', privileges: [APP_PRIVILEGES.vehicle] },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/vehicles/vehicle-list/vehicle-list.component').then(m => m.VehicleListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/vehicles/vehicle-form/vehicle-form.component').then(m => m.VehicleFormComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./components/vehicles/vehicle-form/vehicle-form.component').then(m => m.VehicleFormComponent),
      },
      {
        path: ':id/gallery',
        loadComponent: () => import('./components/vehicles/vehicle-gallery/vehicle-gallery.component').then(m => m.VehicleGalleryComponent),
      },
      {
        path: ':id/details',
        loadComponent: () => import('./components/vehicles/vehicle-form/vehicle-form.component').then(m => m.VehicleFormComponent),
        data: { title: 'Vehicle Preview', breadcrumb: 'Vehicle Preview', viewOnly: true },
      },
    ],
  },
  {
    path: 'category-vehicles',
    data: { title: 'Category Vehicles', breadcrumb: 'Category Vehicles', privileges: [APP_PRIVILEGES.vehicle] },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/category-vehicles/category-vehicle-list/category-vehicle-list.component').then(m => m.CategoryVehicleListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/category-vehicles/category-vehicle-form/category-vehicle-form.component').then(m => m.CategoryVehicleFormComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./components/category-vehicles/category-vehicle-form/category-vehicle-form.component').then(m => m.CategoryVehicleFormComponent),
      },
    ],
  },
  {
    path: 'customers',
    data: { title: 'Customers', breadcrumb: 'Customers', privileges: [APP_PRIVILEGES.customer] },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/customers/customer-list/customer-list.component').then(m => m.CustomerListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/customers/customer-form/customer-form.component').then(m => m.CustomerFormComponent),
      },
      {
        path: ':id/edit',
        loadComponent: () => import('./components/customers/customer-form/customer-form.component').then(m => m.CustomerFormComponent),
      },
      {
        path: ':id/details',
        loadComponent: () => import('./components/customers/customer-details/customer-details.component').then(m => m.CustomerDetailsComponent),
      },
    ],
  },
  {
    path: 'customer-subscriptions',
    data: { title: 'Customer Subscriptions', breadcrumb: 'Customer Subscriptions', roles: TENANT_ADMIN_ROLES },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./components/subscriptions/customer-subscription-list/customer-subscription-list.component').then(
            m => m.CustomerSubscriptionListComponent,
          ),
      },
      {
        path: 'create',
        loadComponent: () =>
          import('./components/subscriptions/customer-subscription-form/customer-subscription-form.component').then(
            m => m.CustomerSubscriptionFormComponent,
          ),
      },
      {
        path: 'edit/:id',
        loadComponent: () =>
          import('./components/subscriptions/customer-subscription-form/customer-subscription-form.component').then(
            m => m.CustomerSubscriptionFormComponent,
          ),
      },
    ],
  },
  {
    path: 'booking',
    data: { title: 'Booking', breadcrumb: 'Booking', privileges: [APP_PRIVILEGES.booking] },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/booking/booking-list/booking-list.component').then(m => m.BookingListComponent),
      },
      {
        path: 'create',
        loadComponent: () => import('./components/booking/booking-form/booking-form.component').then(m => m.BookingFormComponent),
      },
      {
        path: ':id/details',
        loadComponent: () => import('./components/booking/booking-details/booking-details.component').then(m => m.BookingDetailsComponent),
      },
    ],
  },
  {
    path: 'settings',
    data: { title: 'Settings', breadcrumb: 'Settings' },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./components/settings/settings-form/settings-form.component').then(m => m.SettingsFormComponent),
  },
  {
    path: 'security',
    data: { title: 'Security', breadcrumb: 'Security' },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./components/security/security-overview/security-overview.component').then(m => m.SecurityOverviewComponent),
        data: { title: 'Security', breadcrumb: 'My Access' },
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RentRoutingModule {}
