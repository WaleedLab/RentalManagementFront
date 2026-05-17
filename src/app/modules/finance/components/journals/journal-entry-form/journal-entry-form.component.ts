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
import { ActivatedRoute } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { CountingEntry } from '../../../models/counting/counting-entry.model';
import { FinancialYear } from '../../../models/financial-years/financial-year.model';
import {
  CreateJournalEntryRequest,
  JournalEntry,
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
    DatePickerComponent,
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
  private route = inject(ActivatedRoute);
  private languageTick = signal(0);
  private readonly minimumRequiredLines = 2;
  isViewMode = signal(false);

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
  viewBranchName = signal('');
  /** Read-only label: prefers `FinancialYearName` from API, then loaded years list, then id. */
  viewFinancialYearDisplay = signal('');

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
    details: this.fb.array([]),
  });
  detailDraft = this.createDetailLineForm();

  get detailsArray(): any {
    return this.form.controls.details as any;
  }

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(value => value + 1);
    });

    this.form.controls.isManual.setValue(true, { emitEvent: false });
    this.form.controls.isSystemOperation.setValue(false, { emitEvent: false });
    this.loadFinancialYears();
    this.loadBranches();
    this.loadActiveAccounts();
    this.loadCustomers();
    this.loadVehicles();

    const journalId = String(this.route.snapshot.paramMap.get('id') ?? '').trim();
    const isView = this.route.snapshot.url.some(part => part.path === 'view');
    this.isViewMode.set(isView);
    if (isView) {
      // In view mode, never keep template default lines; only backend data is shown.
      while (this.detailsArray.length) {
        this.detailsArray.removeAt(0);
      }
    }

    if (journalId && journalId !== 'undefined' && journalId !== 'null') {
      this.loadJournalForView(journalId);
    }
  }

  addLine(): void {
    if (this.isViewMode()) {
      return;
    }
    this.detailDraft.markAllAsTouched();
    this.detailDraft.updateValueAndValidity();
    if (this.detailDraft.invalid) {
      this.toast.error(this.translate.instant('Each line must have debit or credit only'));
      return;
    }

    const raw = this.detailDraft.getRawValue();
    const newLine = this.createDetailLineForm();
    newLine.patchValue({
      countingId: String(raw.countingId ?? '').trim(),
      countingName: String(raw.countingName ?? '').trim(),
      idVehicle: String(raw.idVehicle ?? '').trim(),
      vehicleName: String(raw.vehicleName ?? '').trim(),
      idCustomer: String(raw.idCustomer ?? '').trim(),
      customerName: String(raw.customerName ?? '').trim(),
      debtir: this.toPositiveNumber(raw.debtir),
      credit: this.toPositiveNumber(raw.credit),
      node: String(raw.node ?? '').trim(),
    });
    this.detailsArray.push(newLine);
    this.detailDraft.reset({
      countingId: '',
      countingName: '',
      idVehicle: '',
      vehicleName: '',
      idCustomer: '',
      customerName: '',
      debtir: 0,
      credit: 0,
      node: '',
    });
  }

  removeLine(index: number): void {
    if (this.detailsArray.length <= this.minimumRequiredLines) {
      this.toast.error(this.translate.instant('At least two lines are required'));
      return;
    }

    this.detailsArray.removeAt(index);
  }

  onDraftDebitInput(): void {
    const debit = this.toPositiveNumber(this.detailDraft.controls.debtir.value);
    if (debit > 0 && this.toPositiveNumber(this.detailDraft.controls.credit.value) > 0) {
      this.detailDraft.patchValue({ credit: 0 }, { emitEvent: false });
    }
    this.detailDraft.updateValueAndValidity();
  }

  onDraftCreditInput(): void {
    const credit = this.toPositiveNumber(this.detailDraft.controls.credit.value);
    if (credit > 0 && this.toPositiveNumber(this.detailDraft.controls.debtir.value) > 0) {
      this.detailDraft.patchValue({ debtir: 0 }, { emitEvent: false });
    }
    this.detailDraft.updateValueAndValidity();
  }

  totalDebit(): number {
    return this.detailsArray.controls.reduce(
      (total: number, line: any) => total + this.toPositiveNumber(line.controls.debtir.value),
      0,
    );
  }

  totalCredit(): number {
    return this.detailsArray.controls.reduce(
      (total: number, line: any) => total + this.toPositiveNumber(line.controls.credit.value),
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
    if (this.isViewMode()) {
      return false;
    }
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
    if (this.isViewMode()) {
      return;
    }
    if (!this.hasMinimumLines()) {
      this.toast.error(this.translate.instant('At least two lines are required'));
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.detailsArray.controls.forEach((line: any) => line.markAllAsTouched());
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    if (!this.isBalanced()) {
      this.toast.error(this.translate.instant('Entry must be balanced before save'));
      return;
    }

    const raw = this.form.getRawValue() as any;
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
      details: (raw.details as any[]).map((line: any) => ({
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

  accountLabelById(id: unknown): string {
    const key = String(id ?? '').trim();
    if (!key) {
      return '-';
    }
    const account = this.accounts().find(item => String(item.id) === key);
    return account ? this.formatAccountLabel(account) : key;
  }

  customerLabelById(id: unknown): string {
    const key = String(id ?? '').trim();
    if (!key) {
      return '-';
    }
    const customer = this.customers().find(item => String(item.id) === key);
    return customer ? this.formatCustomerLabel(customer) : key;
  }

  vehicleLabelById(id: unknown): string {
    const key = String(id ?? '').trim();
    if (!key) {
      return '-';
    }
    const vehicle = this.vehicles().find(item => String(item.id) === key);
    return vehicle ? this.formatVehicleLabel(vehicle) : key;
  }

  detailAccountLabel(index: number): string {
    const backendName = String(this.detailLineValue(index, 'countingName') ?? '').trim();
    return backendName || '-';
  }

  detailCustomerLabel(index: number): string {
    const backendName = String(this.detailLineValue(index, 'customerName') ?? '').trim();
    return backendName || '-';
  }

  detailVehicleLabel(index: number): string {
    const backendName = String(this.detailLineValue(index, 'vehicleName') ?? '').trim();
    return backendName || '-';
  }

  detailLineValue(index: number, key: string): unknown {
    const line = this.detailsArray.at(index);
    const value = (line?.value ?? {}) as Record<string, unknown>;
    return value[key];
  }

  private createDetailLineForm() {
    return this.fb.group(
      {
        countingId: ['', [Validators.required]],
        countingName: [''],
        idVehicle: [''],
        vehicleName: [''],
        idCustomer: [''],
        customerName: [''],
        debtir: [0, [Validators.min(0)]],
        credit: [0, [Validators.min(0)]],
        node: ['', [Validators.maxLength(250)]],
      },
      { validators: this.detailLineValidator },
    );
  }

  private loadJournalForView(journalId: string): void {
    const fleetId = (this.authState.fleetId() ?? '').trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('Fleet context is missing'));
      return;
    }

    this.loading.set(true);
    this.journalService
      .getByIdWithDetails(journalId, fleetId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ entry, details }) => {
          this.viewBranchName.set(String(entry.branchName ?? '').trim());
          this.viewFinancialYearDisplay.set(this.resolveFinancialYearViewLabel(entry));
          this.form.patchValue({
            date: this.toDateTimeLocal(entry.date),
            node: String(entry.node ?? ''),
            journalType: this.toNumericJournalType(entry.journalType),
            operationType: Number(entry.operationType ?? 1),
            status: Number(entry.status ?? 1),
            idFinancialYear: String(entry.idFinancialYear ?? ''),
            idBranch: Number(entry.idBranch ?? this.form.controls.idBranch.value),
            isManual: true,
            isSystemOperation: Boolean(entry.isSystemOperation ?? false),
          });

          while (this.detailsArray.length) {
            this.detailsArray.removeAt(0);
          }

          for (const detail of details.map(detail => this.mapDetailFromBackend(detail))) {
            const line = this.createDetailLineForm();
            line.patchValue(detail);
            this.detailsArray.push(line);
          }

          this.form.disable({ emitEvent: false });
        },
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load journals'));
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  private resolveFinancialYearViewLabel(entry: JournalEntry): string {
    const fromApi = String(entry.financialYearName ?? '').trim();
    if (fromApi) {
      return fromApi;
    }
    const id = String(entry.idFinancialYear ?? '').trim();
    if (!id) {
      return '-';
    }
    const year = this.financialYears().find(y => String(y.id) === id);
    if (year) {
      return this.formatFinancialYearLabel(year);
    }
    return id;
  }

  private mapDetailFromBackend(detail: Record<string, unknown>): {
    countingId: string;
    countingName: string;
    idVehicle: string;
    vehicleName: string;
    idCustomer: string;
    customerName: string;
    debtir: number;
    credit: number;
    node: string;
  } {
    return {
      countingId: String(detail['idCounting'] ?? detail['IdCounting'] ?? '').trim(),
      countingName: String(
        detail['countingName'] ??
          detail['CountingName'] ??
          detail['accountName'] ??
          detail['AccountName'] ??
          '',
      ).trim(),
      idVehicle: String(detail['idVehicle'] ?? detail['IdVehicle'] ?? '').trim(),
      vehicleName: String(
        detail['plateNumber'] ??
          detail['PlateNumber'] ??
          detail['vehiclePlateNumber'] ??
          detail['VehiclePlateNumber'] ??
          detail['vehiclePlatnumber'] ??
          detail['VehiclePlatnumber'] ??
          detail['vehicleName'] ??
          detail['VehicleName'] ??
          '',
      ).trim(),
      idCustomer: String(
        detail['idCustomer'] ??
          detail['IdCustomer'] ??
          detail['customerId'] ??
          detail['CustomerId'] ??
          '',
      ).trim(),
      customerName: String(
        detail['customerName'] ??
          detail['CustomerName'] ??
          detail['nameCustomer'] ??
          detail['NameCustomer'] ??
          detail['customerFullName'] ??
          detail['CustomerFullName'] ??
          '',
      ).trim(),
      debtir: this.toPositiveNumber(detail['debtir'] ?? detail['Debtir']),
      credit: this.toPositiveNumber(detail['credit'] ?? detail['Credit']),
      node: String(detail['node'] ?? detail['Node'] ?? '').trim(),
    };
  }

  private toDateTimeLocal(value?: string): string {
    const raw = String(value ?? '').trim();
    if (!raw) {
      return '';
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return raw;
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private toNumericJournalType(value: JournalEntry['journalType']): number {
    if (value === true) {
      return 1;
    }
    if (value === false) {
      return 0;
    }
    return Number(value ?? 1);
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
        if (!this.isViewMode()) {
          const currentYear = years.find(year => year.isCurrentYear) ?? years.at(0);
          if (currentYear) {
            this.form.controls.idFinancialYear.setValue(String(currentYear.id), { emitEvent: false });
          }
        } else {
          const fyId = String(this.form.controls.idFinancialYear.value ?? '').trim();
          const shown = this.viewFinancialYearDisplay().trim();
          if (fyId && shown === fyId) {
            const match = years.find(y => String(y.id) === fyId);
            if (match) {
              this.viewFinancialYearDisplay.set(this.formatFinancialYearLabel(match));
            }
          }
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
      .getList(fleetId)
      .subscribe({
        next: branchesList => {
          const branches = (branchesList ?? []).filter(branch => branch.isActive !== false);
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

  onCustomerSearch(_term: string): void {}

  onVehicleSearch(_term: string): void {}

  private loadCustomers(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingCustomers.set(true);

    this.customerService
      .getList({ fleetId, isActive: true })
      .subscribe({
        next: customers => {
          this.customers.set(customers ?? []);
        },
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load customers'));
          this.loadingCustomers.set(false);
        },
        complete: () => this.loadingCustomers.set(false),
      });
  }

  private loadVehicles(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    const branchId = Number(this.authState.branchId() ?? 0) || undefined;
    this.loadingVehicles.set(true);

    this.vehicleService
      .getList({ fleetId, branchId, status: '', includeEmptyStatus: true })
      .subscribe({
        next: vehicles => {
          const direct = vehicles ?? [];
          if (direct.length > 0) {
            this.vehicles.set(direct);
            return;
          }

          // Fallback for backends that still force a status enum value.
          const statuses: Vehicle['status'][] = ['Available', 'Booked', 'Maintenance', 'Inactive', 'Sold'];
          forkJoin(
            statuses.map(status =>
              this.vehicleService.getList({ fleetId, branchId, status }).pipe(
                takeUntilDestroyed(this.destroyRef),
              ),
            ),
          ).subscribe({
            next: groups => {
              const merged = groups.flat();
              const byId = new Map<string, Vehicle>();
              for (const vehicle of merged) {
                byId.set(String(vehicle.id), vehicle);
              }
              this.vehicles.set(Array.from(byId.values()));
            },
            error: err => {
              this.toast.error(err?.message ?? this.translate.instant('Failed to load vehicles'));
              this.loadingVehicles.set(false);
            },
            complete: () => this.loadingVehicles.set(false),
          });
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
