import { FinancialYear } from './financial-year.model';
import { pick } from '../shared/finance-normalizer.utils';

export function normalizeFinancialYear(raw: unknown): FinancialYear {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    financialYearNumber: pick<number>(source, 'financialYearNumber', 'FinancialYearNumber'),
    name: String(pick(source, 'name', 'Name') ?? ''),
    startDate: pick<string>(source, 'startDate', 'StartDate'),
    endDate: pick<string>(source, 'endDate', 'EndDate'),
    isCurrentYear: pick<boolean>(source, 'isCurrentYear', 'IsCurrentYear'),
  };
}

