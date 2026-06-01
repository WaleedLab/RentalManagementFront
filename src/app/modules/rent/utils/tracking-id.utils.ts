/**
 * `Tracking/GetApi` → `GetTrackingQuery.IdVehicle` (int64).
 * Backend loads the vehicle with `GetByIdAsync(IdVehicle)` then calls GPS with its `SerialNumber`.
 * Send the vehicle **DB id** (e.g. `1201`), not the GPS serial / plate.
 */
export function resolveTrackingIdVehicle(vehicleDbId: string | null | undefined): number {
  const raw = String(vehicleDbId ?? '').trim();
  if (!raw || !/^\d+$/.test(raw)) {
    throw new Error('Vehicle not found for tracking');
  }

  const idVehicle = Number(raw);
  if (!Number.isFinite(idVehicle) || idVehicle <= 0 || !Number.isInteger(idVehicle)) {
    throw new Error('Vehicle not found for tracking');
  }

  return idVehicle;
}
