import { HttpErrorResponse } from '@angular/common/http';

import { ApiResponse } from '../../../shared/models';

const TRACKING_NO_DATA_PATTERNS = [
  'no data found',
  'لا توجد بيانات',
  'no tracking data',
] as const;

const TRACKING_GENERIC_MESSAGES = [
  'one or more validation errors occurred',
  'bad request',
  'validation failed',
] as const;

/** ASP.NET ProblemDetails / Result envelope → user-facing strings (never raw JSON). */
export function extractTrackingFailureMessages(err: unknown): string[] {
  const messages: string[] = [];

  if (err instanceof HttpErrorResponse) {
    messages.push(...extractMessagesFromBody(err.error));
    return messages;
  }

  if (err instanceof Error && err.message?.trim()) {
    messages.push(err.message.trim());
  } else if (typeof err === 'string' && err.trim()) {
    messages.push(err.trim());
  }

  return messages;
}

function extractMessagesFromBody(body: unknown): string[] {
  if (body == null) {
    return [];
  }

  if (typeof body === 'string') {
    const trimmed = body.trim();
    if (!trimmed) {
      return [];
    }
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        return flattenTrackingMessages(JSON.parse(trimmed) as unknown);
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }

  if (typeof body === 'object') {
    return flattenTrackingMessages(body);
  }

  return [String(body)];
}

function flattenTrackingMessages(raw: unknown): string[] {
  if (!raw || typeof raw !== 'object') {
    return [];
  }

  const record = raw as Record<string, unknown>;
  const collected: string[] = [];

  const errors = record['errors'] ?? record['Errors'];
  if (Array.isArray(errors)) {
    collected.push(...errors.map(item => String(item)).filter(Boolean));
  } else if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        collected.push(...value.map(item => String(item)).filter(Boolean));
      } else if (value != null && value !== '') {
        collected.push(String(value));
      }
    }
  }

  const validation = record['validation'] ?? record['Validation'];
  if (Array.isArray(validation)) {
    collected.push(...validation.map(item => String(item)).filter(Boolean));
  }

  const detail = record['detail'] ?? record['Detail'];
  if (typeof detail === 'string' && detail.trim()) {
    collected.push(detail.trim());
  }

  const data = record['data'] ?? record['Data'];
  if (typeof data === 'string' && data.trim()) {
    collected.push(data.trim());
  }

  return collected;
}

export function isGenericTrackingMessage(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (!normalized || normalized.startsWith('http failure response')) {
    return true;
  }
  if (normalized.startsWith('https://tools.ietf.org')) {
    return true;
  }
  return TRACKING_GENERIC_MESSAGES.some(fragment => normalized.includes(fragment));
}

export function pickPrimaryTrackingMessage(err: unknown, fallback = 'Tracking load failed'): string {
  const messages = extractTrackingFailureMessages(err).filter(message => !isGenericTrackingMessage(message));
  if (messages.length > 0) {
    return messages[0].slice(0, 800);
  }
  return fallback;
}

/**
 * Tracking/GetApi may return a plain map URL (`text/plain`) or a JSON `Result<string>` body.
 */
export function parseTrackingApiBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    throw new Error('Tracking request failed');
  }

  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed) as ApiResponse<string> | string;
    if (typeof parsed === 'string') {
      return parsed.trim();
    }
    const data = parsed.data ?? (parsed as { Data?: string }).Data;
    if (data !== null && data !== undefined && String(data).trim()) {
      return String(data).trim();
    }
    const errors = flattenTrackingMessages(parsed);
    if (errors.length) {
      const err = new Error(errors.join(' '));
      if (isTrackingNoDataError(err)) {
        throw err;
      }
      throw err;
    }
    if (parsed.succeeded === false || (parsed as { Succeeded?: boolean }).Succeeded === false) {
      throw new Error('Tracking request failed');
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
  }

  return trimmed;
}

export function isTrackingNoDataError(err: unknown): boolean {
  return extractTrackingFailureMessages(err).some(message => {
    const normalized = message.trim().toLowerCase();
    return TRACKING_NO_DATA_PATTERNS.some(pattern => normalized.includes(pattern));
  });
}
