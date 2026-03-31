export interface CashAccount {
  id: string;
  countingId?: string;
  name: string;
  description?: string;
  fleetId?: string;
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
}

