import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, distinctUntilChanged, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { BranchService } from '../../../../rent/services/branches/branch.service';
import { JournalEntry } from '../../../models/journals/journal-entry.model';
import {
  FinanceListAction,
  FinanceListColumn,
  FinanceListRow,
} from '../../../models/shared/finance-list.model';
import { FinancialYearService } from '../../../services/financial-years/financial-year.service';
import { JournalEntryService } from '../../../services/journals/journal-entry.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceDate, formatFinanceNumber } from '../../shared/finance-list-formatters';
import { SmoothSelectComponent } from '../../../../../shared/ui/smooth-select/smooth-select.component';

@Component({
  selector: 'app-journal-entry-list',
  standalone: true,
  imports: [FinanceListShellComponent, SmoothSelectComponent, TranslateModule],
  templateUrl: './journal-entry-list.component.html',
  styleUrl: './journal-entry-list.component.scss',
})
export class JournalEntryListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private journalService = inject(JournalEntryService);
  private financialYearService = inject(FinancialYearService);
  private branchService = inject(BranchService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);

  items = signal<JournalEntry[]>([]);
  financialYearNames = signal<Record<string, string>>({});
  branchNames = signal<Record<string, string>>({});
  loading = signal(false);
  loadError = signal<string | null>(null);
  pageNumber = signal(1);
  pageSize = signal(10);
  totalPages = signal(1);
  totalCount = signal(0);
  search = signal('');
  statusFilter = signal<number | ''>('');
  journalTypeFilter = signal<'true' | 'false' | ''>('');
  operationTypeFilter = signal<number | ''>('');
  branchFilter = signal<number | ''>('');
  dateFrom = signal('');
  dateTo = signal('');
  orderBy = signal('CreatedAt');
  orderByDirection = signal<'ASC' | 'DESC'>('DESC');
  private searchInput$ = new Subject<string>();
  private languageTick = signal(0);

  readonly orderByOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('Created At'), value: 'CreatedAt' },
      { label: t('Name'), value: 'Name' },
    ];
  });
  readonly statusFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All statuses'), value: '' },
      { label: t('Closed'), value: 1 },
      { label: t('Editable'), value: 2 },
    ];
  });
  readonly journalTypeFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All journal types'), value: '' },
      { label: t('General Journal'), value: 'true' },
      { label: t('Adjustment Journal'), value: 'false' },
    ];
  });
  readonly operationTypeFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All operation types'), value: '' },
      { label: t('Accounting Entry'), value: 1 },
      { label: t('Receipt'), value: 2 },
      { label: t('Payment Voucher'), value: 3 },
      { label: t('Opening'), value: 4 },
      { label: t('Expense Entry'), value: 5 },
      { label: t('Accidents Recorded'), value: 6 },
    ];
  });
  readonly branchFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const options: SmoothSelectOption[] = [{ label: this.translate.instant('All branches'), value: '' }];
    for (const [id, label] of Object.entries(this.branchNames())) {
      options.push({ label: label || '-', value: Number(id) });
    }
    return options;
  });

  readonly columns: FinanceListColumn[] = [
    { key: 'number', label: 'Journal Number', align: 'end' },
    { key: 'date', label: 'Date' },
    { key: 'status', label: 'Status' },
    { key: 'journalType', label: 'Journal Type' },
    { key: 'operationType', label: 'Operation Type' },
    { key: 'debit', label: 'Debit', align: 'end' },
    { key: 'credit', label: 'Credit', align: 'end' },
    { key: 'balance', label: 'Balance', align: 'end' },
    { key: 'branch', label: 'Branch' },
    { key: 'financialYear', label: 'Financial Year' },
  ];
  readonly rowActions: FinanceListAction[] = [
    { key: 'view', label: 'View', icon: 'fa-solid fa-eye', variant: 'info', iconOnly: true },
    { key: 'print', label: 'Print', icon: 'fa-solid fa-print', variant: 'secondary', iconOnly: true },
  ];

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    return this.items().map(item => ({
      number: formatFinanceNumber(item.journalNumper, this.translate),
      date: formatFinanceDate(item.date, this.translate),
      status: this.formatStatus(item.status),
      journalType: this.formatJournalType(item.journalType),
      operationType: this.formatOperationType(item.operationType),
      debit: formatFinanceNumber(item.debtir, this.translate),
      credit: formatFinanceNumber(item.credit, this.translate),
      balance: formatFinanceNumber(item.balannce, this.translate),
      branch: this.resolveBranchDisplay(item),
      financialYear: this.resolveFinancialYearDisplay(item),
    }));
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(value => value + 1);
    });
    this.searchInput$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(search => {
        this.search.set(search.trim());
        this.pageNumber.set(1);
        this.load();
      });
    this.loadBranches();
    this.loadFinancialYears();
    this.load();
  }

  private loadBranches(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.branchNames.set({});
      return;
    }

    this.branchService
      .getPaginated({ fleetId, pageNumber: 1, pageSize: 200, search: '' }, { suppressErrorToast: true })
      .subscribe({
        next: response => {
          const dictionary: Record<string, string> = {};
          for (const branch of response.items ?? []) {
            const key = String(branch.id ?? '').trim();
            if (!key) {
              continue;
            }
            const name = (branch.nameAr || branch.nameEn || '').trim();
            dictionary[key] = name || String(branch.id);
          }
          this.branchNames.set(dictionary);
        },
        error: () => this.branchNames.set({}),
      });
  }

  private loadFinancialYears(): void {
    const fleetId = this.authState.fleetId();
    this.financialYearService.getList(fleetId).subscribe({
      next: years => {
        const dictionary: Record<string, string> = {};
        for (const year of years) {
          const key = String(year.id ?? '').trim();
          if (!key) {
            continue;
          }
          dictionary[key] = year.name?.trim() || String(year.financialYearNumber ?? '');
        }
        this.financialYearNames.set(dictionary);
      },
      error: () => this.financialYearNames.set({}),
    });
  }

  private load(): void {
    const fleetId = this.authState.fleetId();
    const requestedPageNumber = this.pageNumber();
    const requestedPageSize = this.pageSize();

    this.loading.set(true);
    this.loadError.set(null);

    this.journalService
      .getPaginated({
        fleetId,
        branchId: Number(this.branchFilter() || 0) || undefined,
        status: Number(this.statusFilter() || 0) || undefined,
        journalType:
          this.journalTypeFilter() === ''
            ? undefined
            : this.journalTypeFilter() === 'true',
        operationType: Number(this.operationTypeFilter() || 0) || undefined,
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        search: this.search(),
        dateFrom: this.dateFrom() || undefined,
        dateTo: this.dateTo() || undefined,
        orderBy: this.orderBy(),
        orderByDirection: this.orderByDirection(),
      })
      .subscribe({
      next: response => {
        this.items.set(response.items ?? []);
        this.pageNumber.set(response.pageNumber || 1);
        this.totalPages.set(response.totalPages || 1);
        this.totalCount.set(response.totalCount || 0);
      },
      error: err => {
        const message = err?.message ?? this.translate.instant('No records found');
        this.loadError.set(message);
        this.toast.error(message);
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  onSearchChange(value: string): void {
    this.searchInput$.next(value ?? '');
  }

  onOrderByChange(value: string): void {
    const normalized = value?.trim() || 'CreatedAt';
    if (this.orderBy() === normalized) {
      return;
    }
    this.orderBy.set(normalized);
    this.pageNumber.set(1);
    this.load();
  }

  onStatusFilterChange(value: number | ''): void {
    this.statusFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onJournalTypeFilterChange(value: 'true' | 'false' | ''): void {
    this.journalTypeFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onOperationTypeFilterChange(value: number | ''): void {
    this.operationTypeFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onBranchFilterChange(value: number | ''): void {
    this.branchFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onOrderByDirectionChange(value: 'ASC' | 'DESC'): void {
    if (this.orderByDirection() === value) {
      return;
    }
    this.orderByDirection.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onDateRangeChange(range: { from: string; to: string }): void {
    const nextFrom = (range?.from ?? '').trim();
    const nextTo = (range?.to ?? '').trim();
    if (this.dateFrom() === nextFrom && this.dateTo() === nextTo) {
      return;
    }
    this.dateFrom.set(nextFrom);
    this.dateTo.set(nextTo);
    this.pageNumber.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    const target = Math.max(1, Number(page) || 1);
    if (target === this.pageNumber()) {
      return;
    }
    this.pageNumber.set(target);
    this.load();
  }

  onPageSizeChange(size: number): void {
    const normalized = Math.max(1, Number(size) || 10);
    if (normalized === this.pageSize()) {
      return;
    }
    this.pageSize.set(normalized);
    this.pageNumber.set(1);
    this.load();
  }

  onRowAction(event: { actionKey: string; rowIndex: number }): void {
    const item = this.items()[event.rowIndex];
    if (!item) {
      return;
    }

    if (event.actionKey === 'view') {
      const journalId = String(item.id ?? '').trim();
      if (!journalId || journalId === 'undefined' || journalId === 'null') {
        this.toast.error(this.translate.instant('Failed to load journals'));
        return;
      }
      this.router.navigate(['/journals', item.id, 'view']);
      return;
    }

    const fleetId = this.authState.fleetId();
    const journalId = String(item.id ?? '').trim();
    if (!fleetId || !journalId) {
      this.toast.error(this.translate.instant('Unable to load journal details from backend'));
      return;
    }

    this.journalService
      .getByIdWithDetails(journalId, fleetId)
      .pipe(
        catchError(() => {
          this.toast.error(this.translate.instant('Unable to load journal details from backend'));
          return of(null);
        }),
      )
      .subscribe(response => {
        if (!response) {
          return;
        }
        const title = `${this.translate.instant('Journal Number')}: ${response.entry.journalNumper ?? response.entry.id}`;
        const body = this.buildJournalPrintContent(response.entry);
        this.openPrintWindow(
          title,
          body,
          event.actionKey === 'print',
          String(response.entry.journalNumper ?? response.entry.id ?? '-'),
          response.entry,
          response.details,
        );
      });
  }

  private openPrintWindow(
    title: string,
    content: string,
    autoPrint: boolean,
    documentNumber: string,
    item?: JournalEntry,
    details: Array<Record<string, unknown>> = [],
  ): void {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const payloadKey = `finance-print-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = {
      template: 'journal',
      dir: isArabic ? 'rtl' : 'ltr',
      companyName: this.translate.instant('Car Rental Management'),
      documentKind: this.translate.instant('Official Journal'),
      title,
      printDateLabel: this.translate.instant('Print Date'),
      printDate: new Date().toLocaleString(),
      branchLabel: this.translate.instant('Branch'),
      branchName: this.resolveBranchNameFromBackend(item),
      docNoLabel: this.translate.instant('Document No.'),
      documentNo: documentNumber || '-',
      content,
      autoPrint: autoPrint ? '1' : '0',
      taxRecord: String(item?.taxNumber ?? '').trim() || '-',
      date: item?.date ?? '',
      statusLabel: item ? this.formatStatus(item.status) : '-',
      journalTypeLabel: item ? this.formatJournalType(item.journalType) : '-',
      operationTypeLabel: item ? this.formatOperationType(item.operationType) : '-',
      financialYear: this.resolveFinancialYearFromBackend(item),
      debit: formatFinanceNumber(item?.debtir, this.translate),
      credit: formatFinanceNumber(item?.credit, this.translate),
      balance: formatFinanceNumber(item?.balannce, this.translate),
      journalDetails: this.resolveJournalDetailsForPrint(details),
      logoUrl: String(item?.urllogo ?? '').trim(),
      branchStreet: String(item?.branchStreet ?? '').trim(),
      branchNeighborHood: String(item?.branchNeighborHood ?? '').trim(),
      branchBuldingNumber: String(item?.branchBuldingNumber ?? '').trim(),
      branchCity: String(item?.branchCity ?? '').trim(),
      branchAddress: this.resolveBranchAddressFromBackend(item),
    };
    localStorage.setItem(payloadKey, JSON.stringify(payload));
    const page = autoPrint ? 'invoise-print.html' : 'invoise-view.html';
    const url = `${window.location.origin}/assets/pyment/${page}?payloadKey=${encodeURIComponent(payloadKey)}`;
    const win = window.open(url, '_blank', 'width=980,height=760');
    if (!win) {
      this.toast.error(this.translate.instant('Unable to open print preview window'));
      localStorage.removeItem(payloadKey);
    }
  }

  private buildJournalPrintContent(item: JournalEntry): string {
    return `
      <table>
        <tr>
          <th>${this.translate.instant('Journal Number')}</th>
          <td>${item.journalNumper ?? '-'}</td>
          <th>${this.translate.instant('Date')}</th>
          <td>${formatFinanceDate(item.date, this.translate)}</td>
        </tr>
        <tr>
          <th>${this.translate.instant('Status')}</th>
          <td>${this.formatStatus(item.status)}</td>
          <th>${this.translate.instant('Journal Type')}</th>
          <td>${this.formatJournalType(item.journalType)}</td>
        </tr>
        <tr>
          <th>${this.translate.instant('Operation Type')}</th>
          <td>${this.formatOperationType(item.operationType)}</td>
          <th>${this.translate.instant('Branch')}</th>
          <td>${this.resolveBranchDisplay(item)}</td>
        </tr>
        <tr>
          <th>${this.translate.instant('Financial Year')}</th>
          <td colspan="3">${this.resolveFinancialYearDisplay(item)}</td>
        </tr>
      </table>
      <table>
        <tr>
          <th>${this.translate.instant('Debit')}</th>
          <th>${this.translate.instant('Credit')}</th>
          <th>${this.translate.instant('Balance')}</th>
        </tr>
        <tr>
          <td>${formatFinanceNumber(item.debtir, this.translate)}</td>
          <td>${formatFinanceNumber(item.credit, this.translate)}</td>
          <td>${formatFinanceNumber(item.balannce, this.translate)}</td>
        </tr>
      </table>

      <div class="summary">${this.translate.instant('Journal Summary')} - ${this.translate.instant('Balanced Entry Record')}</div>

      <div class="signatures">
        <div class="sig-box">${this.translate.instant('Prepared By')}</div>
        <div class="sig-box">${this.translate.instant('Reviewed By')}</div>
        <div class="sig-box">${this.translate.instant('Approved By')}</div>
      </div>
    `;
  }

  private resolveJournalDetailsForPrint(details: Array<Record<string, unknown>>): Array<{
    accountCode: string;
    account: string;
    debit: string;
    credit: string;
    note: string;
  }> {
    return (details ?? [])
      .map(row => {
        const accountCode = String(
          row['countingNumber'] ??
            row['CountingNumber'] ??
            row['idCounting'] ??
            row['IdCounting'] ??
            '',
        ).trim();
        const account = String(
          row['countingName'] ??
            row['CountingName'] ??
            row['accountName'] ??
            row['AccountName'] ??
            '',
        ).trim();
        const debit = formatFinanceNumber(
          Number(row['debtir'] ?? row['Debtir'] ?? 0),
          this.translate,
        );
        const credit = formatFinanceNumber(
          Number(row['credit'] ?? row['Credit'] ?? 0),
          this.translate,
        );
        const note = String(row['node'] ?? row['Node'] ?? '').trim();
        return {
          accountCode: accountCode || '.---.',
          account: account || '.---.',
          debit: debit || '.---.',
          credit: credit || '.---.',
          note: note || '.---.',
        };
      })
      .filter(
        row =>
          row.accountCode !== '.---.' ||
          row.account !== '.---.' ||
          row.debit !== '.---.' ||
          row.credit !== '.---.' ||
          row.note !== '.---.',
      );
  }

  private resolveBranchNameFromBackend(item?: JournalEntry): string {
    const branchName = String(item?.branchName ?? '').trim();
    if (branchName) {
      return branchName;
    }
    const idBranch = Number(item?.idBranch ?? 0);
    return Number.isFinite(idBranch) && idBranch > 0 ? String(idBranch) : '-';
  }

  private resolveFinancialYearFromBackend(item?: JournalEntry): string {
    const financialYearName = String(item?.financialYearName ?? '').trim();
    if (financialYearName) {
      return financialYearName;
    }
    const idFinancialYear = String(item?.idFinancialYear ?? '').trim();
    return idFinancialYear || '-';
  }

  private resolveBranchAddressFromBackend(item?: JournalEntry): string {
    const city = String(item?.branchCity ?? '').trim();
    const neighborhood = String(item?.branchNeighborHood ?? '').trim();
    const street = String(item?.branchStreet ?? '').trim();
    const building = String(item?.branchBuldingNumber ?? '').trim();
    const parts = [city, neighborhood, street].filter(Boolean);
    if (building) {
      parts.push(`No. ${building}`);
    }
    return parts.join(' - ');
  }

  private formatStatus(status?: number): string {
    if (status === 1) {
      return this.translate.instant('Closed');
    }
    if (status === 2) {
      return this.translate.instant('Editable');
    }
    return formatFinanceNumber(status, this.translate);
  }

  private formatJournalType(journalType?: number | boolean): string {
    if (journalType === true || journalType === 1) {
      return this.translate.instant('General Journal');
    }
    if (journalType === false || journalType === 0) {
      return this.translate.instant('Adjustment Journal');
    }
    return '-';
  }

  private formatOperationType(operationType?: number): string {
    switch (operationType) {
      case 1:
        return this.translate.instant('Accounting Entry');
      case 2:
        return this.translate.instant('Receipt');
      case 3:
        return this.translate.instant('Payment Voucher');
      case 4:
        return this.translate.instant('Opening');
      case 5:
        return this.translate.instant('Expense Entry');
      case 6:
        return this.translate.instant('Accidents Recorded');
      default:
        return formatFinanceNumber(operationType, this.translate);
    }
  }

  private resolveFinancialYearDisplay(item: JournalEntry): string {
    if (item.financialYearName?.trim()) {
      return item.financialYearName;
    }

    const key = String(item.idFinancialYear ?? '').trim();
    if (key) {
      const byLookup = this.financialYearNames()[key];
      if (byLookup) {
        return byLookup;
      }
    }

    return formatFinanceNumber(item.idFinancialYear, this.translate);
  }

  private resolveBranchDisplay(item: JournalEntry): string {
    if (item.branchName?.trim()) {
      return item.branchName;
    }

    const key = String(item.idBranch ?? '').trim();
    if (key) {
      const byLookup = this.branchNames()[key];
      if (byLookup) {
        return byLookup;
      }
    }

    return formatFinanceNumber(item.idBranch, this.translate);
  }
}

