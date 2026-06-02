import { HttpErrorResponse } from '@angular/common/http';

import { pickPrimaryTrackingMessage } from './tracking-api.utils';

/** Surfaces backend / HTTP messages instead of a generic tracking failure or raw JSON. */
export function resolveTrackingErrorMessage(err: unknown, fallback = 'Tracking load failed'): string {
  if (err instanceof HttpErrorResponse) {
    const message = pickPrimaryTrackingMessage(err, '');
    if (message) {
      return message;
    }
  }

  if (err instanceof Error) {
    const message = err.message?.trim();
    if (message && message !== 'Tracking load failed' && !message.startsWith('Http failure response')) {
      const endpointPrefix = 'Tracking/GetApi:';
      if (message.startsWith(endpointPrefix)) {
        return message.slice(endpointPrefix.length).trim() || fallback;
      }
      const primary = pickPrimaryTrackingMessage(err, '');
      if (primary) {
        return primary;
      }
      return message;
    }
  }

  const primary = pickPrimaryTrackingMessage(err, '');
  if (primary) {
    return primary;
  }

  return fallback;
}
