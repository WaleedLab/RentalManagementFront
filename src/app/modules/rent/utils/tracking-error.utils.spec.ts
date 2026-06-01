import { HttpErrorResponse } from '@angular/common/http';

import { resolveTrackingErrorMessage } from './tracking-error.utils';

describe('resolveTrackingErrorMessage', () => {
  it('returns backend errors from HttpErrorResponse body', () => {
    const err = new HttpErrorResponse({
      error: { errors: ['Vehicle not found'] },
      status: 400,
    });
    expect(resolveTrackingErrorMessage(err)).toBe('Vehicle not found');
  });

  it('returns validation message instead of generic ProblemDetails title', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'One or more validation errors occurred.',
        errors: { validation: ['No data found'] },
      },
    });
    expect(resolveTrackingErrorMessage(err)).toBe('No data found');
  });

  it('strips Tracking/GetApi prefix from Error messages', () => {
    const err = new Error('Tracking/GetApi: API request failed');
    expect(resolveTrackingErrorMessage(err)).toBe('API request failed');
  });

  it('uses fallback for generic tracking failure', () => {
    expect(resolveTrackingErrorMessage(new Error('Tracking load failed'))).toBe('Tracking load failed');
  });
});
