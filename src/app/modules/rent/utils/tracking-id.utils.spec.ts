import { resolveTrackingIdVehicle } from './tracking-id.utils';

describe('resolveTrackingIdVehicle', () => {
  it('uses vehicle DB id for IdVehicle', () => {
    expect(resolveTrackingIdVehicle('1201')).toBe(1201);
    expect(resolveTrackingIdVehicle('1404')).toBe(1404);
  });

  it('rejects non-numeric ids (e.g. GUID routes)', () => {
    expect(() => resolveTrackingIdVehicle('11111111-0000-0000-0000-000000000001')).toThrow(
      /not found/i,
    );
    expect(() => resolveTrackingIdVehicle('')).toThrow(/not found/i);
  });
});
