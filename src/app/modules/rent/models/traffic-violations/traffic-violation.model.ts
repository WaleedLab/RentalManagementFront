/** Mirrors backend `TrafficViolationOrderingEnum` (int). Default 0 = typical first enum member. */
export type TrafficViolationOrderBy = number;

export interface TrafficViolation {
  id: string;
  nameViolation?: string;
  /** `null` / absent when not linked to a booking (matches `long? IdBooking`). */
  idBooking: number | null;
  idVehicle: number;
  /** Display helpers from nested `booking` / `vehicle` when API includes them. */
  bookingLabel?: string;
  vehiclePlate?: string;
  dateViolation: string;
  violationFine: number;
  description?: string;
  numberViolation: number;
  fleetId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrafficViolationFilters {
  fleetId?: string | null;
  pageNumber: number;
  pageSize: number;
  search?: string;
  orderBy?: TrafficViolationOrderBy;
  orderByDirection?: 'ASC' | 'DESC';
}

export interface TrafficViolationUpsertRequest {
  id?: string;
  nameViolation?: string;
  /** Omitted or JSON `null` when not tied to a booking (matches `long? IdBooking`). */
  idBooking?: number | null;
  idVehicle: number;
  dateViolation: string;
  violationFine: number;
  description?: string;
  numberViolation: number;
  fleetId: string;
}
