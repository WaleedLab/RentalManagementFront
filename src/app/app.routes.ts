import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';

import { authGuard } from './shared/services/auth/auth.guard';


/**
 * التوجيه الرئيسي (مطابق للدليل):
 * - مسار فارغ → redirect إلى dashboard
 * - قالب واحد (ContentComponent) وأطفاله: dashboard + loadChildren لكل module
 */
export const routes: Routes = [
  { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
  {
    path: 'auth',
    loadChildren: () => import('./auth/authentication.module').then(m => m.AuthenticationModule),
  },
  {
    path: '',
    loadComponent: () => import('./shared/component/layout/content/content').then(m => m.Content),
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadChildren: () => import('./modules/finance/finance.module').then(m => m.FinanceModule),
      },
      {
        path: '',
        loadChildren: () => import('./modules/rent/rent.module').then(m => m.RentModule),
      },
      {
        path: '',
        loadChildren: () => import('./modules/maintenance/maintenance.module').then(m => m.MaintenanceModule),
      },
    ],
  },
  { path: '**', redirectTo: 'auth/404' },
];

@NgModule({
  imports: [
    RouterModule.forRoot(routes, {
      scrollPositionRestoration: 'top',
      anchorScrolling: 'enabled',
      preloadingStrategy: PreloadAllModules,
    }),
  ],
  exports: [RouterModule],
})
export class AppRoutingModule {}
