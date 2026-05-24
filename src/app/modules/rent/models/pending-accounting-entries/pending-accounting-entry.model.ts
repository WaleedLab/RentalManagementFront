export interface PendingAccountingEntry {
  id: string;
  fleetId?: string;
  branchId?: number;
  paymentcountId?: string;
  entryDate?: string;
  amount?: number;
  description?: string;
  isPosted?: boolean;
}
