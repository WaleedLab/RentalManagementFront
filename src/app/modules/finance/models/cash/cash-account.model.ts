export interface CashAccount {
  id: string;
  countingId?: string;
  name: string;
  description?: string;
  fleetId?: string;
  idBranch?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateCashAccountRequest {
  id: string;
  countingId: string;
  name: string;
  description?: string;
  createdBy: string;
  fleetId: string;
  /** Branch registered at login; `0` when absent. */
  idBranch: number;
}

