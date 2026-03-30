export type FinanceCellValue = string | number | boolean | null | undefined;

export interface FinanceListColumn {
  key: string;
  label: string;
  align?: 'start' | 'end';
}

export interface FinanceListRow {
  [key: string]: FinanceCellValue;
}

