import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { catchError, throwError } from 'rxjs';

import { SUPPRESS_ERROR_TOAST } from './http-context.tokens';
import { TokenService } from '../services/storage/token.service';
import { ToastService } from '../services/toast.service';

function joinPropertyErrors(propertyErrors: Record<string, unknown>): string | null {
  const joined = Object.values(propertyErrors)
    .flatMap(value => (Array.isArray(value) ? value : [value]))
    .map(x => String(x))
    .filter(Boolean)
    .join(' ');
  return joined.length > 0 ? joined : null;
}

/** Backend `Result<T>` / ApiResponse-style maps plus ASP.NET ProblemDetails + ModelState. */
function formatHttpValidationMessage(errorBody: unknown): string | null {
  if (typeof errorBody === 'string') {
    const t = errorBody.trim();
    return t.length > 0 ? t.slice(0, 800) : null;
  }
  if (!errorBody || typeof errorBody !== 'object') {
    return null;
  }
  const e = errorBody as Record<string, unknown>;
  const topPe = e['propertyErrors'];
  if (topPe && typeof topPe === 'object') {
    const flat = joinPropertyErrors(topPe as Record<string, unknown>);
    if (flat) {
      return flat.slice(0, 800);
    }
  }
  const nested = e['error'];
  if (nested && typeof nested === 'object') {
    const ne = nested as Record<string, unknown>;
    const npe = ne['propertyErrors'];
    if (npe && typeof npe === 'object') {
      const flat = joinPropertyErrors(npe as Record<string, unknown>);
      if (flat) {
        return flat.slice(0, 800);
      }
    }
    const nestedMsg = ne['message'];
    if (typeof nestedMsg === 'string' && nestedMsg.trim()) {
      return nestedMsg.trim().slice(0, 800);
    }
  }
  const message = e['message'];
  if (typeof message === 'string' && message.trim()) {
    return message.trim().slice(0, 800);
  }
  const rawErrors = e['errors'];
  if (Array.isArray(rawErrors)) {
    const joined = rawErrors.map(x => String(x)).filter(Boolean).join(' ');
    return joined || null;
  }
  if (rawErrors && typeof rawErrors === 'object') {
    const joined = Object.values(rawErrors as Record<string, unknown[]>)
      .flat()
      .map(x => String(x))
      .filter(Boolean)
      .join(' ');
    return joined || null;
  }
  const title = e['title'];
  const detail = e['detail'];
  if (typeof title === 'string' && typeof detail === 'string' && (title || detail)) {
    return `${title}${title && detail ? ': ' : ''}${detail}`;
  }
  if (typeof detail === 'string' && detail.trim()) {
    return detail.trim();
  }
  if (typeof title === 'string' && title.trim()) {
    return title.trim();
  }
  return null;
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const translate = inject(TranslateService);
  const suppressErrorToast = req.context.get(SUPPRESS_ERROR_TOAST);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401) {
        tokenService.removeToken();
        router.navigate(['/auth/login']);
        toast.error(translate.instant('Session expired. Please login again.'));
      } else if (suppressErrorToast) {
        return throwError(() => err);
      } else {
        const validation = formatHttpValidationMessage(err.error);
        if (validation) {
          toast.error(validation);
        } else if (Array.isArray(err.error?.errors) && err.error.errors.length) {
          toast.error(err.error.errors.join(' '));
        } else if (err.message) {
          toast.error(err.message);
        }
      }
      return throwError(() => err);
    }),
  );
};
