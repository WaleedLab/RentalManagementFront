export interface JournalEntry {
  id: string;
  journalNumper?: number;
  date?: string;
  node?: string;
  journalType?: number | boolean;
  status?: number;
  debtir?: number;
  credit?: number;
  balannce?: number;
  isManual?: boolean;
  operationType?: number;
  isSystemOperation?: boolean;
  idFinancialYear?: string | number;
  financialYearName?: string;
  idBranch?: number;
  branchName?: string;
  fleetId?: string;
}

export interface JournalEntryPaginatedRequest {
  pageNumber: number;
  pageSize: number;
  fleetId?: string | null;
  branchId?: number | null;
  status?: number | null;
  journalType?: boolean | null;
  operationType?: number | null;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  orderByDirection?: 'ASC' | 'DESC';
  orderBy?: string;
}

export interface JournalDetailLineRequest {
  countingId: string;
  countingNumber?: number;
  debtir: number;
  credit: number;
  node?: string;
  idVehicle?: number;
  idCustomer?: number;
  idBranch?: number;
  fleetId?: string;
}

export interface CreateJournalEntryRequest {
  date: string;
  node: string;
  journalType: boolean;
  debtir: number;
  credit: number;
  balannce: number;
  operationType: number;
  status: number;
  isSystemOperation?: boolean;
  idFinancialYear?: string;
  idBranch: number;
  fleetId: string;
  details: CreateJournalDetailRequest[];
}

export interface CreateJournalDetailRequest {
  idCounting: string;
  debtir: number;
  credit: number;
  balannce: number;
  node?: string;
  status?: number;
  idVehicle?: number;
  customerId?: number;
}

