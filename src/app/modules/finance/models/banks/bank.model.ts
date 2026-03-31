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
}

