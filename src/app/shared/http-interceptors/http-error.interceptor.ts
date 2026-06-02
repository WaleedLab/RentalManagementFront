import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
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

function buildFriendlyHttpMessage(
  reqUrl: string,
  err: HttpErrorResponse,
  translate: TranslateService,
): string {
  if (err.status === 0) {
    return translate.instant('Unexpected error. Please try again later.');
  }
  if (err.status >= 500) {
    return translate.instant('Unexpected error. Please try again later.');
  }

  const validation = formatHttpValidationMessage(err.error);
  if (validation) {
    return validation;
  }
  if (err.status === 400) {
    const lowerUrl = (reqUrl || '').toLowerCase();
    if (lowerUrl.includes('/bank')) {
      return translate.instant('Bank data is incomplete. Please fill in the required fields.');
    }
    if (lowerUrl.includes('/cash')) {
      return translate.instant('Cash account data is incomplete. Please fill in the required fields.');
    }
    if (lowerUrl.includes('/booking')) {
      return translate.instant('Booking data is incomplete. Please fill in the required fields.');
    }
    return translate.instant('Please complete the required fields');
  }
  if (err.status === 401) {
    return translate.instant('Session expired. Please login again.');
  }
  if (err.status === 403) {
    return translate.instant('Unexpected error. Please try again later.');
  }
  if (err.status === 404) {
    return translate.instant('No records found');
  }

  const topMessage =
    typeof err.error?.message === 'string' && err.error.message.trim()
      ? err.error.message.trim()
      : null;
  if (topMessage) {
    return topMessage;
  }

  if (typeof err.message === 'string' && err.message.trim() && !err.message.startsWith('Http failure response')) {
    return err.message.trim();
  }

  return translate.instant('Unexpected error. Please try again later.');
}

export const httpErrorInterceptor: HttpInterceptorFn = (req, next) => {
  const tokenService = inject(TokenService);
  const toast = inject(ToastService);
  const translate = inject(TranslateService);
  const suppressErrorToast = req.context.get(SUPPRESS_ERROR_TOAST);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      const friendlyMessage = buildFriendlyHttpMessage(req.url, err, translate);
      // Normalize the propagated error message so all screens get human-readable text.
      (err as unknown as { message: string }).message = friendlyMessage;

      if (err.status === 401) {
        tokenService.removeToken();
        toast.error(friendlyMessage);
        redirectToLoginWithReload();
      } else if (suppressErrorToast) {
        return throwError(() => err);
      } else {
        toast.error(friendlyMessage);
      }
      return throwError(() => err);
    }),
  );
};

function redirectToLoginWithReload(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const loginPath = '/auth/login';
  const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (currentPath.startsWith(loginPath)) {
    window.location.reload();
    return;
  }
  window.location.replace(loginPath);
}
