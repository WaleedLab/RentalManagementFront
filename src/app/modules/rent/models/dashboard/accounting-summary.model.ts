export type AccountingAlertTone = 'good' | 'warning' | 'risk';

export interface AccountingFilterOption {
  value: string;
  label: string;
}

export interface AccountingKpis {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  cashBalance: number;
  bankBalance: number;
  receivables: number;
}

export interface AccountingCashFlowPoint {
  label: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface AccountingRevenueExpensePoint {
  label: string;
  revenue: number;
  expenses: number;
}

export interface AccountingProfitPoint {
  label: string;
  value: number;
}

export interface AccountingTopDebtor {
  customerName: string;
  debtAmount: number;
}

export interface AccountingRecentJournal {
  journalNumber: string;
  date: string;
  debit: number;
  credit: number;
  isBalanced?: boolean;
}

export interface AccountingAlert {
  type: AccountingAlertTone;
  title: string;
  description: string;
}

export interface AccountingSummaryFilters {
  financialYearId?: string;
  startDate?: string;
  endDate?: string;
  fleet?: string;
  branch?: string;
}

export interface AccountingSummaryResponse {
  kpis: AccountingKpis;
  cashFlow: AccountingCashFlowPoint[];
  revenueVsExpenses: AccountingRevenueExpensePoint[];
  profitTrend: AccountingProfitPoint[];
  topDebtors: AccountingTopDebtor[];
  recentJournals: AccountingRecentJournal[];
  alerts: AccountingAlert[];
  filters: {
    financialYears: AccountingFilterOption[];
    fleets: AccountingFilterOption[];
    branches: AccountingFilterOption[];
  };
}
