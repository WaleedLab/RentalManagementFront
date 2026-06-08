import { HttpErrorResponse } from '@angular/common/http';

import { NormalizedApiError } from './api-error.model';
import { ResultEnvelope } from './result-envelope.model';

export function unwrapEnvelope<T>(response: ResultEnvelope<T>): T {
  if (!response.succeeded) {
    throw new Error(response.errors?.join(' ') || 'Request failed');
  }

  return response.data;
}

function readEnvelopeStringList(envelope: Record<string, unknown>, key: string): string[] {
  const raw = envelope[key];
  if (Array.isArray(raw)) {
    return raw.map(item => String(item)).filter(Boolean);
  }
  return [];
}

function readEnvelopePropertyErrors(envelope: Record<string, unknown>): Record<string, string[]> {
  const raw = envelope['propertyErrors'] ?? envelope['PropertyErrors'];
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, string[]>;
  }
  return {};
}

export function extractApiErrorBodyMessage(errorBody: unknown): string | null {
  if (typeof errorBody === 'string') {
    const t = errorBody.trim();
    return t.length > 0 ? t.slice(0, 800) : null;
  }
  if (!errorBody || typeof errorBody !== 'object') {
    return null;
  }
  const e = errorBody as Record<string, unknown>;
  const errors = [
    ...readEnvelopeStringList(e, 'errors'),
    ...readEnvelopeStringList(e, 'Errors'),
  ];
  if (errors.length) {
    return errors.join(' ').slice(0, 800);
  }
  const nestedErrors = e['errors'];
  if (nestedErrors && typeof nestedErrors === 'object' && !Array.isArray(nestedErrors)) {
    const joined = Object.values(nestedErrors as Record<string, unknown>)
      .flatMap(value => (Array.isArray(value) ? value : [value]))
      .map(item => String(item))
      .filter(Boolean)
      .join(' ');
    if (joined) {
      return joined.slice(0, 800);
    }
  }
  const propertyErrors = readEnvelopePropertyErrors(e);
  const validationMessages = Object.values(propertyErrors).flatMap(value =>
    Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [],
  );
  if (validationMessages.length) {
    return validationMessages.join(' ').slice(0, 800);
  }
  const message = e['message'] ?? e['Message'];
  if (typeof message === 'string' && message.trim()) {
    return message.trim().slice(0, 800);
  }
  const title = typeof e['title'] === 'string' ? e['title'].trim() : '';
  const detail = typeof e['detail'] === 'string' ? e['detail'].trim() : '';
  if (title || detail) {
    return `${title}${title && detail ? ': ' : ''}${detail}`.trim();
  }
  return null;
}

export function normalizeApiError(error: unknown): NormalizedApiError {
  if (error instanceof HttpErrorResponse) {
    const envelope =
      error.error && typeof error.error === 'object'
        ? (error.error as Record<string, unknown>)
        : {};
    const errors = [
      ...readEnvelopeStringList(envelope, 'errors'),
      ...readEnvelopeStringList(envelope, 'Errors'),
    ];
    const propertyErrors = readEnvelopePropertyErrors(envelope);
    const validationMessages = Object.values(propertyErrors).flatMap(value =>
      Array.isArray(value) ? value.map(item => String(item)).filter(Boolean) : [],
    );
    const fromBody = extractApiErrorBodyMessage(error.error);
    const message =
      errors[0] ||
      validationMessages[0] ||
      fromBody ||
      (typeof envelope['message'] === 'string' ? envelope['message'] : '') ||
      (typeof envelope['Message'] === 'string' ? envelope['Message'] : '') ||
      (error.status === 404 ? 'API endpoint not found' : '') ||
      error.message ||
      'Unexpected error';

    return {
      status: error.status,
      message: String(message),
      errors,
      propertyErrors,
      isValidation: validationMessages.length > 0 || error.status === 400,
      isUnauthorized: error.status === 401,
      isForbidden: error.status === 403,
      raw: error,
    };
  }

  return {
    status: 0,
    message: error instanceof Error ? error.message : 'Unexpected error',
    errors: error instanceof Error ? [error.message] : [],
    propertyErrors: {},
    isValidation: false,
    isUnauthorized: false,
    isForbidden: false,
    raw: error,
  };
}
