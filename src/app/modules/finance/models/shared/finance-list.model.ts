export type FinanceCellValue = string | number | boolean | null | undefined;

export interface FinanceListColumn {
  key: string;
  label: string;
  align?: 'start' | 'end';
}

export interface FinanceListRow {
  [key: string]: FinanceCellValue;
}

export interface FinanceListAction {
  key: string;
  label: string;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'info' | 'warning' | 'danger' | 'light';
  iconOnly?: boolean;
  /** When set, renders a real link (supports Ctrl+Click / open in new tab). */
  route?: (row: FinanceListRow) => string[] | null;
}

