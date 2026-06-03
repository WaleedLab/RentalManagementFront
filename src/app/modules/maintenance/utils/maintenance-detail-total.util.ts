import { MaintenanceDetail } from '../models/maintenance-detail.model';

/** Sum of line price + tax for all maintenance detail rows. */
export function sumMaintenanceDetailLines(details: MaintenanceDetail[]): number {
  return details.reduce(
    (sum, row) => sum + (Number(row.price) || 0) + (Number(row.tax) || 0),
    0,
  );
}
