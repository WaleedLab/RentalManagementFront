export interface Bank {
  id: string;
  countingId?: string;
  name: string;
  description?: string;
  code?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreateBankRequest {
  countingId: string;
  name: string;
  description?: string;
  code?: string;
  fleetId: string;
  /** Branch registered at login; `0` when absent. */
  idBranch: number;
}

export interface UpdateBankRequest extends CreateBankRequest {
  id: string;
}

