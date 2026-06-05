import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { BranchService } from '../../../../rent/services/branches/branch.service';
import { JournalEntry } from '../../../models/journals/journal-entry.model';
import { FinancialYearService } from '../../../services/financial-years/financial-year.service';
import { JournalEntryService } from '../../../services/journals/journal-entry.service';
import { JournalEntryListComponent } from '../../journals/journal-entry-list/journal-entry-list.component';

describe('JournalEntryListComponent', () => {
  let fixture: ComponentFixture<JournalEntryListComponent>;
  let component: JournalEntryListComponent;
  let journalServiceSpy: jasmine.SpyObj<JournalEntryService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  const fleetId = '11111111-0000-0000-0000-000000000001';
  const financialYearId = '77777777-0000-0000-0000-000000000401';

  const mockJournals: JournalEntry[] = [
    {
      id: 'journal-1',
      journalNumper: 25,
      date: '2026-05-19T09:00:00',
      journalType: true,
      status: 1,
      debtir: 100,
      credit: 100,
      balannce: 0,
      operationType: 2,
      isSystemOperation: false,
      idFinancialYear: financialYearId,
      idBranch: 12,
      fleetId,
    },
    {
      id: 'journal-2',
      journalNumper: 26,
      date: '2026-05-20T09:00:00',
      journalType: false,
      status: 2,
      debtir: 90,
      credit: 80,
      balannce: 10,
      operationType: 3,
      isSystemOperation: true,
      financialYearName: 'FY 2026',
      branchName: 'Main Branch',
      fleetId,
    },
  ];

  const journalDetails = [
    {
      IdCounting: 'cash',
      CountingNumber: 1101,
      CountingName: 'Cash',
      Debtir: 100,
      Credit: 0,
      Node: 'Cash line',
    },
    {
      IdCounting: 'revenue',
      CountingNumber: 4101,
      CountingName: 'Rental Revenue',
      Debtir: 0,
      Credit: 100,
      Node: 'Revenue line',
    },
  ];

  function paginated(items: JournalEntry[] = mockJournals) {
    return {
      items,
      pageNumber: 1,
      pageSize: 10,
      totalCount: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / 10)),
    };
  }

  function configure(journalResponse = of(paginated())): void {
    journalServiceSpy = jasmine.createSpyObj<JournalEntryService>('JournalEntryService', [
      'getPaginated',
      'getByIdWithDetails',
    ]);
    journalServiceSpy.getPaginated.and.returnValue(journalResponse);
    journalServiceSpy.getByIdWithDetails.and.returnValue(of({
      entry: mockJournals[0],
      details: journalDetails,
    }));

    const financialYearServiceSpy = jasmine.createSpyObj<FinancialYearService>('FinancialYearService', ['getList']);
    financialYearServiceSpy.getList.and.returnValue(of([
      {
        id: financialYearId,
        financialYearNumber: 2026,
        name: 'FY 2026',
        startDate: '2026-01-01',
        endDate: '2026-12-31',
        isCurrentYear: true,
      },
    ]));

    const branchServiceSpy = jasmine.createSpyObj<BranchService>('BranchService', ['getPaginated']);
    branchServiceSpy.getPaginated.and.returnValue(of({
      items: [
        { id: 12, nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch', fleetId, isActive: true },
      ],
      pageNumber: 1,
      pageSize: 200,
      totalCount: 1,
      totalPages: 1,
    }) as any);

    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning', 'info']);

    TestBed.configureTestingModule({
      imports: [
        JournalEntryListComponent,
        NoopAnimationsModule,
        RouterTestingModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: JournalEntryService, useValue: journalServiceSpy },
        { provide: FinancialYearService, useValue: financialYearServiceSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthStateService, useValue: { fleetId: jasmine.createSpy('fleetId').and.returnValue(fleetId) } },
      ],
    });

    fixture = TestBed.createComponent(JournalEntryListComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates the component without errors', () => {
    configure();

    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('loads paginated journal entries on init using the current fleet id', () => {
    configure();

    fixture.detectChanges();

    expect(journalServiceSpy.getPaginated).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      fleetId,
      pageNumber: 1,
      pageSize: 10,
      search: '',
      orderBy: 'CreatedAt',
      orderByDirection: 'DESC',
    }));
    expect(component.items().length).toBe(2);
    expect(component.totalCount()).toBe(2);
  });

  it('displays journal rows with number, date, status, type, debit, credit, and balance', () => {
    configure();

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('25');
    expect(text).toContain('26');
    expect(text).toContain('Closed');
    expect(text).toContain('Editable');
    expect(text).toContain('General Journal');
    expect(text).toContain('Adjustment Journal');
    expect(text).toContain('Receipt');
    expect(text).toContain('Payment Voucher');
    expect(text).toContain('100');
    expect(text).toContain('90');
    expect(text).toContain('10');
  });

  it('shows an empty state when the service returns an empty page', () => {
    configure(of(paginated([])));

    fixture.detectChanges();

    expect(component.items()).toEqual([]);
    expect(component.totalCount()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Table empty hint');
  });

  it('shows and clears loading state around an in-flight paginated request', () => {
    const request$ = new Subject<ReturnType<typeof paginated>>();
    configure(request$.asObservable());

    fixture.detectChanges();

    expect(component.loading()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.spinner-border')).not.toBeNull();

    request$.next(paginated());
    request$.complete();
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('25');
  });

  it('debounces search and reloads with the normalized search value', fakeAsync(() => {
    configure();
    fixture.detectChanges();

    component.onSearchChange('  rent journal  ');
    tick(350);

    expect(component.search()).toBe('rent journal');
    expect(component.pageNumber()).toBe(1);
    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      search: 'rent journal',
      pageNumber: 1,
    }));
  }));

  it('applies journal filters through service params', () => {
    configure();
    fixture.detectChanges();

    component.onStatusFilterChange(1);
    component.onJournalTypeFilterChange('true');
    component.onOperationTypeFilterChange(2);
    component.onBranchFilterChange(12);
    component.onDateRangeChange({ from: '2026-05-01', to: '2026-05-31' });

    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({ status: 1 }));
    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 1,
      journalType: true,
    }));
    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 1,
      journalType: true,
      operationType: 2,
    }));
    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      status: 1,
      journalType: true,
      operationType: 2,
      branchId: 12,
    }));
    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      dateFrom: '2026-05-01',
      dateTo: '2026-05-31',
    }));
  });

  it('applies sorting changes through service params', () => {
    configure();
    fixture.detectChanges();

    component.onOrderByChange('Date');
    component.onOrderByDirectionChange('ASC');

    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      orderBy: 'Date',
      orderByDirection: 'DESC',
      pageNumber: 1,
    }));
    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      orderBy: 'Date',
      orderByDirection: 'ASC',
      pageNumber: 1,
    }));
  });

  it('applies pagination changes through service params', () => {
    configure();
    fixture.detectChanges();

    component.onPageChange(2);
    component.onPageSizeChange(20);

    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      pageNumber: 2,
      pageSize: 10,
    }));
    expect(journalServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      pageNumber: 1,
      pageSize: 20,
    }));
  });

  it('loads journal details for print action and opens the print window', () => {
    configure();
    fixture.detectChanges();
    spyOn(window, 'open').and.returnValue({} as Window);

    component.onRowAction({ actionKey: 'print', rowIndex: 0 });

    expect(journalServiceSpy.getByIdWithDetails).toHaveBeenCalledOnceWith('journal-1', fleetId);
    expect(window.open).toHaveBeenCalled();
  });

  it('handles empty journal details when printing', () => {
    configure();
    journalServiceSpy.getByIdWithDetails.and.returnValue(of({ entry: mockJournals[0], details: [] }));
    fixture.detectChanges();
    spyOn(window, 'open').and.returnValue({} as Window);

    component.onRowAction({ actionKey: 'print', rowIndex: 0 });

    expect(journalServiceSpy.getByIdWithDetails).toHaveBeenCalledWith('journal-1', fleetId);
    expect(window.open).toHaveBeenCalled();
  });

  it('keeps view action as route-only and does not load details directly', () => {
    configure();
    fixture.detectChanges();

    component.onRowAction({ actionKey: 'view', rowIndex: 0 });

    expect(journalServiceSpy.getByIdWithDetails).not.toHaveBeenCalled();
    expect(component.rowActions[0].route?.(component.rows()[0])).toEqual(['/journals', 'view', 'journal-1']);
  });

  it('shows error state and toast when paginated load fails', () => {
    configure(throwError(() => new Error('Journal load failed')));

    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBe('Journal load failed');
    expect(toastSpy.error).toHaveBeenCalledWith('Journal load failed');
    expect(fixture.nativeElement.querySelector('.spinner-border')).not.toBeNull();
  });

  it('formats null journal fields safely', () => {
    configure(of(paginated([
      {
        id: 'null-journal',
        journalNumper: undefined,
        date: undefined,
        journalType: undefined,
        status: undefined,
        debtir: undefined,
        credit: undefined,
        balannce: undefined,
        operationType: undefined,
        idFinancialYear: undefined,
        idBranch: undefined,
      },
    ])));

    fixture.detectChanges();

    const row = component.rows()[0];
    expect(row['number']).toBe('-');
    expect(row['date']).toBe('-');
    expect(row['status']).toBe('-');
    expect(row['journalType']).toBe('-');
    expect(row['operationType']).toBe('-');
    expect(row['debit']).toBe('-');
    expect(row['credit']).toBe('-');
    expect(row['balance']).toBe('-');
    expect(row['branch']).toBe('-');
    expect(row['financialYear']).toBe('-');
  });

  it('represents balanced and unbalanced journals in row values without breaking the UI', () => {
    configure();

    fixture.detectChanges();

    const rows = component.rows();
    expect(rows[0]['debit']).toBe(rows[0]['credit']);
    expect(rows[0]['balance']).toBe('0');
    expect(rows[1]['debit']).not.toBe(rows[1]['credit']);
    expect(rows[1]['balance']).toBe('10');
  });

  it('shows manual/system journal data through operation labels without breaking display', () => {
    configure();

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Receipt');
    expect(text).toContain('Payment Voucher');
  });
});
