import { HttpErrorResponse } from '@angular/common/http';

import { isTrackingNoDataError, parseTrackingApiBody, pickPrimaryTrackingMessage } from './tracking-api.utils';

describe('parseTrackingApiBody', () => {
  it('returns plain text map URL', () => {
    const url = 'https://v20gps.ewe4tech.net/Reports/Path/CustomPage/8790?f=2025-05-06%2002:00:00';
    expect(parseTrackingApiBody(url)).toBe(url);
  });

  it('unwraps JSON Result envelope', () => {
    const url = 'https://example.com/map';
    expect(
      parseTrackingApiBody(JSON.stringify({ succeeded: true, data: url, errors: [] })),
    ).toBe(url);
  });

  it('throws on empty body', () => {
    expect(() => parseTrackingApiBody('   ')).toThrow(/failed/i);
  });
});

describe('tracking HTTP errors', () => {
  it('detects No data found from ProblemDetails validation array', () => {
    const err = new HttpErrorResponse({
      status: 400,
      error: {
        type: 'https://tools.ietf.org/html/rfc7231#section-6.5.1',
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: { validation: ['No data found'] },
      },
    });
    expect(isTrackingNoDataError(err)).toBe(true);
    expect(pickPrimaryTrackingMessage(err)).toBe('No data found');
  });
});
