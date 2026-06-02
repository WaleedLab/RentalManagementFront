import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { APP_PRIVILEGES } from '../../core/auth/access.constants';
import { authGuard } from '../../shared/services/auth/auth.guard';
import { privilegeGuard } from '../../shared/services/auth/privilege.guard';

const routes: Routes = [
  {
    path: 'maintenance',
    data: {
      title: 'maintenance.listTitle',
      breadcrumb: 'maintenance.listTitle',
      privileges: [APP_PRIVILEGES.vehicle],
    },
    canActivate: [authGuard, privilegeGuard],
    children: [
      {
        path: '',
        data: { title: 'maintenance.listTitle', breadcrumb: 'maintenance.listTitle' },
        loadComponent: () =>
          import('./components/maintenance-list/maintenance-list.component').then(
            m => m.MaintenanceListComponent,
          ),
      },
      {
        path: 'create',
        data: { title: 'maintenance.createTitle', breadcrumb: 'maintenance.createTitle' },
        loadComponent: () =>
          import('./components/maintenance-form/maintenance-form.component').then(
            m => m.MaintenanceFormComponent,
          ),
      },
      {
        path: ':id/edit',
        data: { title: 'maintenance.editTitle', breadcrumb: 'maintenance.editTitle' },
        loadComponent: () =>
          import('./components/maintenance-form/maintenance-form.component').then(
            m => m.MaintenanceFormComponent,
          ),
      },
      {
        path: 'insurance-companies',
        data: {
          title: 'maintenance.insurance.listTitle',
          breadcrumb: 'maintenance.insurance.listTitle',
        },
        loadComponent: () =>
          import('./components/insurance-company-list/insurance-company-list.component').then(
            m => m.InsuranceCompanyListComponent,
          ),
      },
      {
        path: 'insurance-companies/create',
        data: {
          title: 'maintenance.insurance.createTitle',
          breadcrumb: 'maintenance.insurance.createTitle',
        },
        loadComponent: () =>
          import('./components/insurance-company-form/insurance-company-form.component').then(
            m => m.InsuranceCompanyFormComponent,
          ),
      },
      {
        path: 'insurance-companies/:id/edit',
        data: {
          title: 'maintenance.insurance.editTitle',
          breadcrumb: 'maintenance.insurance.editTitle',
        },
        loadComponent: () =>
          import('./components/insurance-company-form/insurance-company-form.component').then(
            m => m.InsuranceCompanyFormComponent,
          ),
      },
      {
        path: 'spare-parts',
        data: {
          title: 'maintenance.sparePart.listTitle',
          breadcrumb: 'maintenance.sparePart.listTitle',
        },
        loadComponent: () =>
          import('./components/spare-part-list/spare-part-list.component').then(
            m => m.SparePartListComponent,
          ),
      },
      {
        path: 'spare-parts/create',
        data: {
          title: 'maintenance.sparePart.createTitle',
          breadcrumb: 'maintenance.sparePart.createTitle',
        },
        loadComponent: () =>
          import('./components/spare-part-form/spare-part-form.component').then(
            m => m.SparePartFormComponent,
          ),
      },
      {
        path: 'spare-parts/:id/edit',
        data: {
          title: 'maintenance.sparePart.editTitle',
          breadcrumb: 'maintenance.sparePart.editTitle',
        },
        loadComponent: () =>
          import('./components/spare-part-form/spare-part-form.component').then(
            m => m.SparePartFormComponent,
          ),
      },
      {
        path: 'suppliers',
        data: {
          title: 'maintenance.supplier.listTitle',
          breadcrumb: 'maintenance.supplier.listTitle',
        },
        loadComponent: () =>
          import('./components/supplier-list/supplier-list.component').then(
            m => m.SupplierListComponent,
          ),
      },
      {
        path: 'suppliers/create',
        data: {
          title: 'maintenance.supplier.createTitle',
          breadcrumb: 'maintenance.supplier.createTitle',
        },
        loadComponent: () =>
          import('./components/supplier-form/supplier-form.component').then(
            m => m.SupplierFormComponent,
          ),
      },
      {
        path: 'suppliers/:id/edit',
        data: {
          title: 'maintenance.supplier.editTitle',
          breadcrumb: 'maintenance.supplier.editTitle',
        },
        loadComponent: () =>
          import('./components/supplier-form/supplier-form.component').then(
            m => m.SupplierFormComponent,
          ),
      },
    ],
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MaintenanceRoutingModule {}
