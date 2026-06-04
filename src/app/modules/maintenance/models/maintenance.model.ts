/** Mirrors backend `MaintenanceOrderingEnum` (int). */
export type MaintenanceOrderBy = number;

export interface MaintenanceSparePartLine {
  idSparePartName: number;
  quantity: number;
  sparePartName?: string;
}

export interface Maintenance {
  id: string;
  idBranch: number;
  branchName?: string;
  idVehicle: number;
  plateNumber?: string;
  idBooking: number | null;
  idInsurancecompanies: number | null;
  insuranceCompanyName?: string;
  idSupplier?: number | null;
  supplierName?: string;
  startDate: string;
  endDate?: string;
  odometerIn?: string;
  odometerOut?: string;
  durationMaintenance?: string;
  typeCompensation?: string;
  note?: string;
  valueCompensation: number;
  /** Numeric legacy codes or backend `MaintenanceEnum` string names. */
  status: number | string;
  isAcceptable: boolean;
  fleetId?: string;
  url?: string;
  total?: number | null;
  createdBy?: string;
  spareParts?: MaintenanceSparePartLine[];
}

/** `GET Maintenance/GetTotal/{idbooking}/{fleetid}` — `GetMaintenanceByIdBookingQueryResponse`. */
export interface MaintenanceByBookingSummary {
  status: number | string;
  total: number | null;
}

export interface MaintenanceFilters {
  fleetId?: string | null;
  branchId?: number | null;
  pageNumber: number;
  pageSize: number;
  search?: string;
  orderBy?: MaintenanceOrderBy;
  orderByDirection?: 'ASC' | 'DESC';
}

/**
 * Simplified create/update payload: a maintenance record is opened for a
 * vehicle only, with an optional booking + insurance company + note.
 * The fleet id is sent automatically.
 */
export interface MaintenanceUpsertRequest {
  id?: string;
  fleetId: string;
  idVehicle: number;
  idBooking?: number | null;
  idInsurancecompanies?: number | null;
  note?: string | null;
}

/** `AcceptableMaintenanceCommand` — `MaintenanceRouting.Acceptable` → PUT `Maintenance/Acceptable/{id}`. */
export interface MaintenanceAcceptRequest {
  id: string | number;
  fleetId: string;
  startDate: string;
  /** Positive day count; sent to API as `Durationmaintanance`. */
  durationMaintenance: string;
  /** Computed: start + duration days. */
  endDate: string;
}

/** `FinshMaintenceCommand` — `MaintenanceRouting.Finsh` → PUT `Maintenance/Finsh/{id}`. */
export interface MaintenanceFinishRequest {
  id: string | number;
  fleetId: string;
  endDate: string;
  /** Sum of detail line price + tax. */
  total: number;
}
