export interface FinancialYear {
  id: string;
  financialYearNumber?: number;
  name: string;
  startDate?: string;
  endDate?: string;
  isCurrentYear?: boolean;
}

export interface CreateFinancialYearRequest {
  financialYearNumber: number;
  name: string;
  startDate: string;
  endDate: string;
  isCurrentYear: boolean;
  fleetId: string;
}

