import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { SUPPRESS_ERROR_TOAST } from './http-context.tokens';
import { TokenService } from '../services/storage/token.service';
import { ToastService } from '../services/toast.service';

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const suppressErrorToast = req.context.get(SUPPRESS_ERROR_TOAST);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        tokenService.removeToken();
        router.navigate(['/auth/login']);
        toast.error('Session expired. Please login again.');
      } else if (suppressErrorToast) {
        return throwError(() => err);
      } else if (err.error?.errors?.length) {
        toast.error(err.error.errors.join(' '));
      } else if (err.message) {
        toast.error(err.message);
      }
      return throwError(() => err);
    }),
  );
};
