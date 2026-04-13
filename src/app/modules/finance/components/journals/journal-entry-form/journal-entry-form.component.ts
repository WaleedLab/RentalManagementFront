import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { CountingEntry } from '../../../models/counting/counting-entry.model';
import { FinancialYear } from '../../../models/financial-years/financial-year.model';
import {
  CreateJournalEntryRequest,
} from '../../../models/journals/journal-entry.model';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';
import { FinancialYearService } from '../../../services/financial-years/financial-year.service';
import { JournalEntryService } from '../../../services/journals/journal-entry.service';
import { Customer } from '../../../../rent/models/customers/customer.model';
import { Vehicle } from '../../../../rent/models/vehicles/vehicle.model';
import { Branch } from '../../../../rent/models/branches/branch.model';
import { CustomerService } from '../../../../rent/services/customers/customer.service';
import { VehicleService } from '../../../../rent/services/vehicles/vehicle.service';
import { BranchService } from '../../../../rent/services/branches/branch.service';

@Component({
  selector: 'app-journal-entry-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    PageHeaderComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './journal-entry-form.component.html',
  styleUrl: './journal-entry-form.component.scss',
})
export class JournalEntryFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private destroyRef = inject(DestroyRef);
  private countingService = inject(CountingEntryService);
  private financialYearService = inject(FinancialYearService);
  private journalService = inject(JournalEntryService);
  private customerService = inject(CustomerService);
  private vehicleService = inject(VehicleService);
  private branchService = inject(BranchService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private languageTick = signal(0);
  private readonly minimumRequiredLines = 2;
  private customerSearch$ = new Subject<string>();
  private vehicleSearch$ = new Subject<string>();

  loading = signal(false);
  loadingAccounts = signal(false);
  loadingFinancialYears = signal(false);
  loadingCustomers = signal(false);
  loadingVehicles = signal(false);
  loadingBranches = signal(false);
  accounts = signal<CountingEntry[]>([]);
  financialYears = signal<FinancialYear[]>([]);
  customers = signal<Customer[]>([]);
  vehicles = signal<Vehicle[]>([]);
  branches = signal<Branch[]>([]);

  readonly accountOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select account'), value: '' },
      ...this.accounts().map(account => ({
        label: this.formatAccountLabel(account),
        value: account.id,
      })),
    ];
  });

  readonly financialYearOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select financial year'), value: '' },
      ...this.financialYears().map(year => ({
        label: this.formatFinancialYearLabel(year),
        value: String(year.id),
      })),
    ];
  });

  readonly customerOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select customer (optional)'), value: '' },
      ...this.customers().map(customer => ({
        label: this.formatCustomerLabel(customer),
        value: String(customer.id),
      })),
    ];
  });

  readonly vehicleOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select vehicle (optional)'), value: '' },
      ...this.vehicles().map(vehicle => ({
        label: this.formatVehicleLabel(vehicle),
        value: String(vehicle.id),
      })),
    ];
  });

  readonly branchOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select branch'), value: '' },
      ...this.branches().map(branch => ({
        label: this.formatBranchLabel(branch),
        value: branch.id,
      })),
    ];
  });

  readonly operationTypeOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select operation type'), value: '' },
      { label: this.translate.instant('Rental Operation'), value: 1 },
      { label: this.translate.instant('Payment Operation'), value: 2 },
      { label: this.translate.instant('Adjustment Operation'), value: 3 },
      { label: this.translate.instant('Opening Balance Operation'), value: 4 },
      { label: this.translate.instant('Other Operation'), value: 5 },
    ];
  });

  readonly statusOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select status'), value: '' },
      { label: this.translate.instant('Confirmed'), value: 1 },
      { label: this.translate.instant('Pending'), value: 2 },
      { label: this.translate.instant('Cancelled'), value: 3 },
    ];
  });

  readonly journalTypeOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('Select journal type'), value: '' },
      { label: this.translate.instant('General Journal'), value: 1 },
      { label: this.translate.instant('Adjustment Journal'), value: 0 },
    ];
  });

  form = this.fb.group({
    date: ['', [Validators.required]],
    node: ['', [Validators.required, Validators.maxLength(500)]],
    journalType: [1 as number | '', [Validators.required]],
    isManual: [true],
    operationType: [1, [Validators.required, Validators.min(1)]],
    status: [1, [Validators.required, Validators.min(1)]],
    isSystemOperation: [false],
    idFinancialYear: ['', [Validators.required]],
    idBranch: [Number(this.authState.branchId() ?? 0), [Validators.required, Validators.min(1)]],
    details: this.fb.array([this.createDetailLineForm(), this.createDetailLineForm()]),
  });

  get detailsArray() {
    return this.form.controls.details;
  }

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(value => value + 1);
    });

    this.form.controls.isManual.setValue(true, { emitEvent: false });
    this.form.controls.isSystemOperation.setValue(false, { emitEvent: false });
    this.customerSearch$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(search => this.loadCustomers(search));
    this.vehicleSearch$
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(search => this.loadVehicles(search));

    this.loadFinancialYears();
    this.loadBranches();
    this.loadActiveAccounts();
    this.loadCustomers('');
    this.loadVehicles('');
  }

  addLine(): void {
    this.detailsArray.push(this.createDetailLineForm());
  }

  removeLine(index: number): void {
    if (this.detailsArray.length <= this.minimumRequiredLines) {
      this.toast.error(this.translate.instant('At least two lines are required'));
      return;
    }

    this.detailsArray.removeAt(index);
  }

  onDebitInput(index: number): void {
    const line = this.detailsArray.at(index);
    const debit = this.toPositiveNumber(line.controls.debtir.value);
    if (debit > 0 && this.toPositiveNumber(line.controls.credit.value) > 0) {
      line.patchValue({ credit: 0 }, { emitEvent: false });
      line.updateValueAndValidity();
    }
  }

  onCreditInput(index: number): void {
    const line = this.detailsArray.at(index);
    const credit = this.toPositiveNumber(line.controls.credit.value);
    if (credit > 0 && this.toPositiveNumber(line.controls.debtir.value) > 0) {
      line.patchValue({ debtir: 0 }, { emitEvent: false });
      line.updateValueAndValidity();
    }
  }

  totalDebit(): number {
    return this.detailsArray.controls.reduce(
      (total, line) => total + this.toPositiveNumber(line.controls.debtir.value),
      0,
    );
  }

  totalCredit(): number {
    return this.detailsArray.controls.reduce(
      (total, line) => total + this.toPositiveNumber(line.controls.credit.value),
      0,
    );
  }

  difference(): number {
    return this.totalDebit() - this.totalCredit();
  }

  isBalanced(): boolean {
    return Math.abs(this.difference()) < 0.00001;
  }

  hasMinimumLines(): boolean {
    return this.detailsArray.length >= this.minimumRequiredLines;
  }

  canSave(): boolean {
    return (
      !this.loading() &&
      !this.loadingAccounts() &&
      !this.loadingFinancialYears() &&
      !this.loadingCustomers() &&
      !this.loadingVehicles() &&
      !this.loadingBranches() &&
      this.accounts().length > 0 &&
      this.financialYears().length > 0 &&
      this.branches().length > 0 &&
      this.form.valid &&
      this.hasMinimumLines() &&
      this.isBalanced()
    );
  }

  onSubmit(): void {
    if (!this.hasMinimumLines()) {
      this.toast.error(this.translate.instant('At least two lines are required'));
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.detailsArray.controls.forEach(line => line.markAllAsTouched());
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    if (!this.isBalanced()) {
      this.toast.error(this.translate.instant('Entry must be balanced before save'));
      return;
    }

    const raw = this.form.getRawValue();
    if (this.toRequiredPositiveInteger(raw.idBranch) <= 0) {
      this.toast.error(this.translate.instant('Please select a valid branch'));
      return;
    }
    const fleetId = (this.authState.fleetId() ?? '').trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('Fleet context is missing'));
      return;
    }
    const parsedDate = new Date(raw.date);
    const totalDebit = this.totalDebit();
    const totalCredit = this.totalCredit();

    const createBody: CreateJournalEntryRequest = {
      date: Number.isNaN(parsedDate.getTime()) ? raw.date : parsedDate.toISOString(),
      node: raw.node.trim(),
      journalType: Number(raw.journalType) === 1,
      debtir: totalDebit,
      credit: totalCredit,
      balannce: totalDebit - totalCredit,
      operationType: raw.operationType,
      status: raw.status,
      isSystemOperation: false,
      idFinancialYear: raw.idFinancialYear,
      idBranch: this.toRequiredPositiveInteger(raw.idBranch),
      fleetId,
      details: raw.details.map(line => ({
        idCounting: String(line.countingId).trim(),
        debtir: this.toPositiveNumber(line.debtir),
        credit: this.toPositiveNumber(line.credit),
        balannce: this.toPositiveNumber(line.debtir) - this.toPositiveNumber(line.credit),
        node: line.node?.trim() || undefined,
        status: raw.status,
        idVehicle: this.toOptionalPositiveInteger(line.idVehicle),
        customerId: this.toOptionalPositiveInteger(line.idCustomer),
      })),
    };

    this.loading.set(true);
    this.journalService.create(createBody).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Journal entry created successfully'));
        this.router.navigate(['/journals']);
      },
      error: err => {
        // Keep raw error in console to inspect backend validation details quickly.
        // eslint-disable-next-line no-console
        console.error('Create journal failed:', err);
        this.toast.error(this.resolveSaveErrorMessage(err));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  trackByIndex(index: number): number {
    return index;
  }

  formatAmount(value: number): string {
    const locale = this.translate.currentLang?.startsWith('ar') ? 'ar-SA' : 'en-US';
    return new Intl.NumberFormat(locale, {
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  }

  private createDetailLineForm() {
    return this.fb.group(
      {
        countingId: ['', [Validators.required]],
        idVehicle: [''],
        idCustomer: [''],
        debtir: [0, [Validators.min(0)]],
        credit: [0, [Validators.min(0)]],
        node: ['', [Validators.maxLength(250)]],
      },
      { validators: this.detailLineValidator },
    );
  }

  private readonly detailLineValidator = (control: AbstractControl): ValidationErrors | null => {
    const debit = this.toPositiveNumber(control.get('debtir')?.value);
    const credit = this.toPositiveNumber(control.get('credit')?.value);
    const hasDebit = debit > 0;
    const hasCredit = credit > 0;

    if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
      return { debitCreditRequired: true };
    }

    return null;
  };

  private loadActiveAccounts(): void {
    const fleetId = this.authState.fleetId();
    this.loadingAccounts.set(true);

    this.countingService.getList(fleetId).subscribe({
      next: entries => {
        const activeEntries = entries
          .filter(entry => this.isEntryActive(entry))
          .sort(
            (left, right) => Number(left.countingNumber ?? 0) - Number(right.countingNumber ?? 0),
          );
        this.accounts.set(activeEntries);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load accounts'));
        this.loadingAccounts.set(false);
      },
      complete: () => this.loadingAccounts.set(false),
    });
  }

  private isEntryActive(entry: CountingEntry): boolean {
    if (entry.isDeleted) {
      return false;
    }

    if (entry.isActive === false) {
      return false;
    }

    if (typeof entry.status === 'number') {
      return entry.status > 0;
    }

    if (typeof entry.status === 'boolean') {
      return entry.status;
    }

    const status = String(entry.status ?? '')
      .toLowerCase()
      .trim();
    if (!status) {
      return true;
    }

    if (status === '0' || status === 'false') {
      return false;
    }

    if (status.includes('inactive') || status.includes('disabled')) {
      return false;
    }

    if (status.includes('غير') && status.includes('نشط')) {
      return false;
    }

    return true;
  }

  private loadFinancialYears(): void {
    const fleetId = this.authState.fleetId();
    this.loadingFinancialYears.set(true);

    this.financialYearService.getList(fleetId).subscribe({
      next: years => {
        this.financialYears.set(years);
        const currentYear = years.find(year => year.isCurrentYear) ?? years.at(0);
        if (currentYear) {
          this.form.controls.idFinancialYear.setValue(String(currentYear.id), { emitEvent: false });
        }
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load financial years'));
        this.loadingFinancialYears.set(false);
      },
      complete: () => this.loadingFinancialYears.set(false),
    });
  }

  private loadBranches(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingBranches.set(true);

    this.branchService
      .getPaginated({ fleetId, pageNumber: 1, pageSize: 200, search: '' })
      .subscribe({
        next: response => {
          const branches = (response.items ?? []).filter(branch => branch.isActive !== false);
          this.branches.set(branches);

          const currentBranchId = Number(this.authState.branchId() ?? 0);
          const fallbackBranch = branches.find(branch => branch.id === currentBranchId) ?? branches.at(0);
          if (fallbackBranch) {
            this.form.controls.idBranch.setValue(fallbackBranch.id, { emitEvent: false });
          }
        },
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load branches'));
          this.loadingBranches.set(false);
        },
        complete: () => this.loadingBranches.set(false),
      });
  }

  onCustomerSearch(term: string): void {
    this.customerSearch$.next(term);
  }

  onVehicleSearch(term: string): void {
    this.vehicleSearch$.next(term);
  }

  private loadCustomers(search: string): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingCustomers.set(true);

    this.customerService
      .getPaginated({ fleetId, pageNumber: 1, pageSize: 50, search, isActive: true })
      .subscribe({
        next: response => {
          this.customers.set(response.items ?? []);
        },
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load customers'));
          this.loadingCustomers.set(false);
        },
        complete: () => this.loadingCustomers.set(false),
      });
  }

  private loadVehicles(search: string): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    const branchId = Number(this.authState.branchId() ?? 0) || undefined;
    this.loadingVehicles.set(true);

    this.vehicleService
      .getPaginated({
        fleetId,
        branchId,
        pageNumber: 1,
        pageSize: 50,
        search,
        status: '',
      })
      .subscribe({
        next: response => {
          this.vehicles.set(response.items ?? []);
        },
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load vehicles'));
          this.loadingVehicles.set(false);
        },
        complete: () => this.loadingVehicles.set(false),
      });
  }

  private formatAccountLabel(account: CountingEntry): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const name =
      (isArabic ? account.nameAr : account.nameEn) || account.nameAr || account.nameEn || '-';
    const number = account.countingNumber ?? '-';
    return `${number} - ${name}`;
  }

  private formatFinancialYearLabel(year: FinancialYear): string {
    const yearNumber = year.financialYearNumber != null ? String(year.financialYearNumber) : '';
    const name = year.name?.trim() || '';
    const dateRange = [year.startDate, year.endDate].filter(Boolean).join(' - ');
    return [yearNumber, name, dateRange].filter(Boolean).join(' | ') || String(year.id);
  }

  private formatCustomerLabel(customer: Customer): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const name =
      (isArabic ? customer.nameAr : customer.nameEn) ||
      customer.fullName ||
      customer.nameAr ||
      customer.nameEn ||
      '-';
    const mobile = customer.firstMobileNumber || customer.phoneNumber || '';
    return [name, mobile].filter(Boolean).join(' - ');
  }

  private formatVehicleLabel(vehicle: Vehicle): string {
    const vehicleName = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
    const plate = vehicle.plateNumber || '';
    const serial = vehicle.serialNumber || '';
    return [vehicleName || '-', plate, serial].filter(Boolean).join(' - ');
  }

  private formatBranchLabel(branch: Branch): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const name = (isArabic ? branch.nameAr : branch.nameEn) || branch.nameAr || branch.nameEn || '-';
    const code = branch.code?.trim() || '';
    return [name, code].filter(Boolean).join(' - ');
  }

  private toPositiveNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return numeric < 0 ? 0 : numeric;
  }

  private toOptionalPositiveInteger(value: unknown): number | undefined {
    const normalized = String(value ?? '').trim();
    if (!normalized) {
      return undefined;
    }
    const numeric = Number(normalized);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return undefined;
    }
    return Math.trunc(numeric);
  }

  private toRequiredPositiveInteger(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0;
  }

  private resolveSaveErrorMessage(error: unknown): string {
    const fallback = this.translate.instant('Failed to save journal entry');
    const source = error as {
      error?: {
        errors?: string[] | Record<string, string[]>;
        propertyErrors?: Record<string, string[]>;
        message?: string;
      };
      message?: string;
    };

    const apiErrors = source?.error?.errors;
    if (Array.isArray(apiErrors) && apiErrors.length) {
      return apiErrors.join(' | ');
    }
    if (apiErrors && typeof apiErrors === 'object') {
      const flattenedErrors = Object.values(apiErrors).flat().filter(Boolean);
      if (flattenedErrors.length) {
        return flattenedErrors.join(' | ');
      }
    }

    const propertyErrors = source?.error?.propertyErrors;
    if (propertyErrors) {
      const flattened = Object.values(propertyErrors).flat().filter(Boolean);
      if (flattened.length) {
        return flattened.join(' | ');
      }
    }

    return source?.error?.message ?? source?.message ?? fallback;
  }
}
