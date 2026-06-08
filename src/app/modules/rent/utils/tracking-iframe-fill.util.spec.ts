import { prepareTrackingIframeHtml, wrapTrackingIframeUrl } from './tracking-iframe-fill.util';

describe('tracking-iframe-fill.util', () => {
  it('injects fill styles and resize script into HTML fragments', () => {
    const out = prepareTrackingIframeHtml('<html><body><table width="900"><tr><td>Map</td></tr></table></body></html>');
    expect(out).toContain('rental-tracking-fill');
    expect(out).toContain('rental-tracking-fill-js');
    expect(out).toContain('width: 100% !important');
    expect(out).toContain('viewport');
  });

  it('wraps tracking URLs in a full-size srcdoc shell', () => {
    const out = wrapTrackingIframeUrl('https://example.com/track?id=1');
    expect(out).toContain('iframe src="https://example.com/track?id=1"');
    expect(out).toContain('__rentalStretchTrackingReport');
    expect(out).toContain('stretchTrackingReport');
  });
});
