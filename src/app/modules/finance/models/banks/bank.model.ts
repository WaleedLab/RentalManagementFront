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
  /** Login branch; `null` for admin without branch claim. */
  idBranch: number | null;
}

export interface UpdateBankRequest extends CreateBankRequest {
  id: string;
}

