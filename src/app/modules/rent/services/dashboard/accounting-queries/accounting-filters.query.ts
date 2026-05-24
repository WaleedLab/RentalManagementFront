import { Observable, forkJoin, map, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

import { BranchService } from '../../branches/branch.service';
import { FleetService } from '../../fleet/fleet.service';
import { FinancialYearService } from '../../../../finance/services/financial-years/financial-year.service';
import {
  AccountingFilterOption,
  AccountingSummaryFilters,
} from '../../../models/dashboard/accounting-summary.model';

export interface AccountingFilterOptionsResult {
  financialYears: AccountingFilterOption[];
  fleets: AccountingFilterOption[];
  branches: AccountingFilterOption[];
}

export function loadAccountingFilterOptions(
  fleetService: FleetService,
  branchService: BranchService,
  financialYearService: FinancialYearService,
  filters: AccountingSummaryFilters,
): Observable<AccountingFilterOptionsResult> {
  const fleetId = String(filters.fleet ?? '').trim() || undefined;

  return forkJoin({
    fleets: fleetService.getList({ suppressErrorToast: true }).pipe(catchError(() => of([]))),
    branches: fleetId
      ? branchService.getList(fleetId).pipe(catchError(() => of([])))
      : of([]),
    financialYears: fleetId
      ? financialYearService.getList(fleetId).pipe(catchError(() => of([])))
      : of([]),
  }).pipe(
    map(({ fleets, branches, financialYears }) => ({
      financialYears: [
        { value: '', label: 'All Financial Years' },
        ...financialYears.map(year => ({
          value: String(year.id),
          label: year.name || String(year.financialYearNumber ?? year.id),
        })),
      ],
      fleets: [
        { value: '', label: 'All Fleets' },
        ...fleets.map(fleet => ({
          value: String(fleet.id),
          label: fleet.name || String(fleet.id),
        })),
      ],
      branches: [
        { value: '', label: 'All branches' },
        ...branches.map(branch => ({
          value: String(branch.id),
          label: branch.nameAr || branch.nameEn || String(branch.id),
        })),
      ],
    })),
  );
}
