/** Mirrors backend `MaintenanceOrderingEnum` (int). */
export type MaintenanceOrderBy = number;

export interface Maintenance {
  id: string;
  idBranch: number;
  branchName?: string;
  idVehicle: number;
  plateNumber?: string;
  idBooking: number | null;
  idInsurancecompanies: number | null;
  insuranceCompanyName?: string;
  startDate: string;
  endDate?: string;
  odometerIn?: string;
  odometerOut?: string;
  durationMaintenance?: string;
  typeCompensation?: string;
  note?: string;
  valueCompensation: number;
  status: number;
  isAcceptable: boolean;
  fleetId?: string;
  url?: string;
  total?: number | null;
  createdBy?: string;
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

export interface MaintenanceUpsertRequest {
  id?: string;
  idBranch: number;
  idVehicle: number;
  idBooking?: number | null;
  idInsurancecompanies?: number | null;
  fleetId: string;
  startDate: string;
  endDate?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  odometerIn?: string | null;
  odometerOut?: string | null;
  durationMaintenance?: string | null;
  typeCompensation?: string | null;
  note?: string | null;
  valueCompensation: number;
  total?: number | null;
  /** New image file (optional). */
  image?: File | null;
  /** Kept on update when no new file is chosen. */
  existingUrl?: string | null;
}
