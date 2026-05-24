/** Shared filter context passed to each accounting dashboard query. */
export interface AccountingDashboardQueryContext {
  fleetId: string;
  branchId?: number;
  dateFrom?: string;
  dateTo?: string;
  financialYearId?: string;
}

export const BOND_TYPE_RECEIPT = 2;
export const BOND_TYPE_PAYMENT_VOUCHER = 1;

export const ACCOUNTING_PAYMENT_PAGE_SIZE = 1000;
export const ACCOUNTING_JOURNAL_CHART_PAGE_SIZE = 500;
export const ACCOUNTING_JOURNAL_RECENT_PAGE_SIZE = 10;
export const ACCOUNTING_PENDING_ALERTS_PAGE_SIZE = 20;
