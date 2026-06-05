import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import {
  coerceFormNumber,
  isEmptyNumericValue,
  requiredNumber,
} from '../../../../../shared/validators/required-number.validator';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, merge, of, startWith } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { loginBranchId } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import {
  CoreCountingAccountTemplate,
  VoucherCollectionChannel,
  resolveVoucherFlow,
} from '../../../common/finance-accounting-blueprints';
import { Bank } from '../../../models/banks/bank.model';
import { CashAccount } from '../../../models/cash/cash-account.model';
import { CountingEntry } from '../../../models/counting/counting-entry.model';
import { FinancialYear } from '../../../models/financial-years/financial-year.model';
import { CreatePaymentCountRequest } from '../../../models/payment-counts/payment-count.model';
import { BankService } from '../../../services/banks/bank.service';
import { CashAccountService } from '../../../services/cash/cash-account.service';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';
import { FinancialYearService } from '../../../services/financial-years/financial-year.service';
import { PaymentCountService } from '../../../services/payment-counts/payment-count.service';
import { Customer } from '../../../../rent/models/customers/customer.model';
import { Vehicle } from '../../../../rent/models/vehicles/vehicle.model';
import { Branch } from '../../../../rent/models/branches/branch.model';
import { Booking } from '../../../../rent/models/booking/booking.model';
import { CustomerService } from '../../../../rent/services/customers/customer.service';
import { VehicleService } from '../../../../rent/services/vehicles/vehicle.service';
import { BranchService } from '../../../../rent/services/branches/branch.service';
import { BookingService } from '../../../../rent/services/booking/booking.service';

@Component({
  selector: 'app-payment-count-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    SmoothSelectComponent,
    ...SHARED_FORM_FIELD_DIRECTIVES,
  ],
  templateUrl: './payment-count-form.component.html',
  styleUrls: ['./payment-count-form.component.scss'],
})
export class PaymentCountFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'voucher-form-section-link',
    'voucher-form-section-payment',
    'voucher-form-section-details',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private authState = inject(AuthStateService);
  private paymentCountService = inject(PaymentCountService);
  private bankService = inject(BankService);
  private cashService = inject(CashAccountService);
  private countingService = inject(CountingEntryService);
  private financialYearService = inject(FinancialYearService);
  private customerService = inject(CustomerService);
  private vehicleService = inject(VehicleService);
  private branchService = inject(BranchService);
  private bookingService = inject(BookingService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  loadingChannels = signal(false);
  loadingAccounts = signal(false);
  loadingFinancialYears = signal(false);
  loadingCustomers = signal(false);
  loadingVehicles = signal(false);
  loadingBranches = signal(false);
  loadingBookings = signal(false);
  banks = signal<Bank[]>([]);
  cashAccounts = signal<CashAccount[]>([]);
  accounts = signal<CountingEntry[]>([]);
  financialYears = signal<FinancialYear[]>([]);
  customers = signal<Customer[]>([]);
  vehicles = signal<Vehicle[]>([]);
  branches = signal<Branch[]>([]);
  bookings = signal<Booking[]>([]);
  paymentTypeValue = signal(1);
  statusValue = signal(1);
  initializing = signal(true);
  submitAttempted = signal(false);
  private readonly i18nTick = signal(0);
  private formProgressTick = signal(0);
  private readonly minimumRequiredLines = 1;
  private syncingSplitAmounts = false;

  readonly cashOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select cash box'), value: '' },
    ...this.cashAccounts().map(item => ({
      label: this.formatCashLabel(item),
      value: item.id,
    })),
  ]);

  readonly bankOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select bank'), value: '' },
    ...this.banks().map(item => ({
      label: this.formatBankLabel(item),
      value: item.id,
    })),
  ]);

  readonly accountOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select account'), value: '' },
    ...this.accounts().map(item => ({
      label: this.formatAccountLabel(item),
      value: item.id,
    })),
  ]);

  readonly financialYearOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select financial year'), value: '' },
    ...this.financialYears().map(item => ({
      label: this.formatFinancialYearLabel(item),
      value: item.id,
    })),
  ]);

  readonly customerOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select customer'), value: '' },
    ...this.customers().map(item => ({
      label: this.formatCustomerLabel(item),
      value: item.id,
    })),
  ]);

  readonly vehicleOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select vehicle'), value: '' },
    ...this.vehicles().map(item => ({
      label: this.formatVehicleLabel(item),
      value: item.id,
    })),
  ]);

  readonly branchOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select branch'), value: '' },
    ...this.branches().map(item => ({
      label: this.formatBranchLabel(item),
      value: item.id,
    })),
  ]);

  readonly bookingOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select booking'), value: '' },
    ...this.bookings().map(item => ({
      label: this.formatBookingLabel(item),
      value: item.id,
    })),
  ]);

  readonly paymentTypeOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('Cash'), value: 1 },
      { label: this.translate.instant('Network/POS'), value: 2 },
      { label: this.translate.instant('Cheque'), value: 3 },
      { label: this.translate.instant('Bank Transfer'), value: 4 },
      { label: this.translate.instant('Bank/Cash'), value: 5 },
    ];
  });

  readonly bondTypeOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('Payment Voucher'), value: 1 },
      { label: this.translate.instant('Receipt Voucher'), value: 2 },
    ];
  });

  readonly statusOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('Confirmed'), value: 1 },
      { label: this.translate.instant('Pending'), value: 2 },
    ];
  });

  readonly bookingStatusOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('Select booking status'), value: '' },
      { label: this.translate.instant('Confirmed'), value: 1 },
      { label: this.translate.instant('Pending'), value: 2 },
      { label: this.translate.instant('Cancelled'), value: 3 },
    ];
  });

  readonly expenseCategoryOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('Select expense category'), value: '' },
      { label: this.translate.instant('Maintenance'), value: 1 },
      { label: this.translate.instant('Operations'), value: 2 },
      { label: this.translate.instant('Bank Charges'), value: 3 },
      { label: this.translate.instant('Fuel'), value: 4 },
      { label: this.translate.instant('Insurance'), value: 5 },
      { label: this.translate.instant('Other'), value: 99 },
    ];
  });

  form = this.fb.group({
    idCustomer: [''],
    paid: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0.01 })]),
    dscription: ['', [Validators.required, Validators.maxLength(500)]],
    idVehicle: [''],
    idBranch: [Number(this.authState.branchId() ?? 0) as number | '', [Validators.required]],
    paymentType: [1, [Validators.required, Validators.min(1)]],
    bondType: [1, [Validators.required, Validators.min(1)]],
    status: [1, [Validators.required, Validators.min(1)]],
    idFinancialYear: ['', [Validators.required]],
    idCash: [''],
    idBank: [''],
    paidCash: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    paidBank: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    expenseCategory: ['' as number | ''],
    idBooking: [''],
    stutusbooking: [1 as number | '', [Validators.required]],
    details: this.fb.array([]),
  });
  detailDraft = this.createDetailLineForm();

  readonly selectedCollectionChannel = computed<VoucherCollectionChannel>(() =>
    Number(this.form.controls.paymentType.value) === 1 ? 'cash' : 'bank',
  );

  readonly suggestedVoucherFlow = computed(() => {
    const bondType = Number(this.form.controls.bondType.value ?? 1);
    const purpose = bondType === 1 ? 'RentalExpensePayment' : 'RentalRevenueCollection';
    return resolveVoucherFlow(purpose, this.selectedCollectionChannel());
  });

  get detailsArray(): any {
    return this.form.controls.details as any;
  }

  linkSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.idBranch.valid;
  });

  paymentSectionComplete = computed(() => {
    this.formProgressTick();
    if (!this.linkSectionComplete()) {
      return false;
    }

    const controls = this.form.controls;
    const baseValid =
      controls.paid.valid &&
      controls.paymentType.valid &&
      controls.bondType.valid &&
      controls.status.valid &&
      controls.idFinancialYear.valid &&
      controls.dscription.valid &&
      controls.paidCash.valid &&
      controls.paidBank.valid;

    if (!baseValid) {
      return false;
    }

    if (this.showExpenseCategoryField() && controls.expenseCategory.invalid) {
      return false;
    }

    if (controls.stutusbooking.enabled && controls.stutusbooking.invalid) {
      return false;
    }

    if (Number(controls.status.value ?? 1) === 1) {
      const paymentType = Number(controls.paymentType.value ?? 1);
      if (paymentType === 1 && controls.idCash.invalid) {
        return false;
      }
      if ([2, 3, 4].includes(paymentType) && controls.idBank.invalid) {
        return false;
      }
    }

    return true;
  });

  detailsSectionComplete = computed(() => {
    this.formProgressTick();
    return (
      this.paymentSectionComplete() &&
      this.detailsArray.length >= this.minimumRequiredLines &&
      this.isDetailsBalanced()
    );
  });

  linesCount = computed(() => this.detailsArray.length);

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.linkSectionComplete()) done++;
    if (this.paymentSectionComplete()) done++;
    if (this.detailsSectionComplete()) done++;
    return Math.round((done / 3) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.linkSectionComplete()) return 1;
    if (!this.paymentSectionComplete()) return 2;
    if (!this.detailsSectionComplete()) return 3;
    return 4;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(value => value + 1));

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.i18nTick.update(value => value + 1);
    });

    this.form.controls.paymentType.valueChanges
      .pipe(startWith(this.form.controls.paymentType.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.paymentTypeValue.set(Number(value ?? 1));
        this.applyBusinessRules();
      });
    this.form.controls.status.valueChanges
      .pipe(startWith(this.form.controls.status.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(value => {
        this.statusValue.set(Number(value ?? 1));
        this.applyBusinessRules();
      });
    this.form.controls.paid.valueChanges
      .pipe(startWith(this.form.controls.paid.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applySplitAmountRules('amount'));
    this.form.controls.paidCash.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applySplitAmountRules('cash'));
    this.form.controls.paidBank.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applySplitAmountRules('bank'));
    this.form.controls.idBooking.valueChanges
      .pipe(startWith(this.form.controls.idBooking.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyBookingStatusRules());
    this.form.controls.bondType.valueChanges
      .pipe(startWith(this.form.controls.bondType.value), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.applyExpenseCategoryRules());

    this.loadCustomers();
    this.loadVehicles();
    this.loadBranches();
    this.loadBookings();
    this.loadFinancialYears();
    this.loadAccounts();
    this.loadChannels();
    this.applySplitAmountRules('type');
    this.applyBookingStatusRules();
    this.applyExpenseCategoryRules();
  }

  addLine(): void {
    this.detailDraft.markAllAsTouched();
    this.detailDraft.updateValueAndValidity();
    if (this.detailDraft.invalid) {
      this.toast.error(this.translate.instant('Each detail line must include account and amount'));
      return;
    }
    const raw = this.detailDraft.getRawValue();
    const newLine = this.createDetailLineForm();
    newLine.patchValue({
      idCounting: String(raw.idCounting ?? '').trim(),
      price: coerceFormNumber(raw.price),
      node: String(raw.node ?? '').trim(),
    });
    this.detailsArray.push(newLine);
    this.detailDraft.reset({
      idCounting: '',
      price: null,
      node: '',
    });
  }

  removeLine(index: number): void {
    if (this.detailsArray.length <= this.minimumRequiredLines) {
      this.toast.error(this.translate.instant('At least one line is required'));
      return;
    }
    this.detailsArray.removeAt(index);
  }

  trackByIndex(index: number): number {
    return index;
  }

  totalDetails(): number {
    return this.detailsArray.controls.reduce((total: number, line: any) => {
      const price = Number(line.controls.price.value ?? 0);
      return total + (Number.isFinite(price) && price > 0 ? price : 0);
    }, 0);
  }

  detailsDifference(): number {
    const paid = Number(this.form.controls.paid.value ?? 0);
    return paid - this.totalDetails();
  }

  isDetailsBalanced(): boolean {
    return Math.abs(this.detailsDifference()) < 0.00001;
  }

  accountLabelById(id: unknown): string {
    const key = String(id ?? '').trim();
    if (!key) {
      return '-';
    }
    const account = this.accounts().find(item => String(item.id) === key);
    return account ? this.formatAccountLabel(account) : key;
  }

  detailLineValue(index: number, key: string): unknown {
    const line = this.detailsArray.at(index);
    const value = (line?.value ?? {}) as Record<string, unknown>;
    return value[key];
  }

  formatAmount(value: number): string {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return '0';
    }
    return numeric.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  focusWorkflowSection(step: 1 | 2 | 3): void {
    const sectionId = PaymentCountFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('voucher-form-section--focus');
    window.setTimeout(() => section.classList.remove('voucher-form-section--focus'), 1400);
  }

  hasFieldError(
    controlName:
      | 'idBranch'
      | 'paid'
      | 'paymentType'
      | 'bondType'
      | 'status'
      | 'idFinancialYear'
      | 'dscription'
      | 'expenseCategory'
      | 'stutusbooking'
      | 'idCash'
      | 'idBank'
      | 'paidCash'
      | 'paidBank',
  ): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  onSubmit(): void {
    this.submitAttempted.set(true);
    const paymentType = Number(this.form.controls.paymentType.value ?? 1);
    const status = Number(this.form.controls.status.value ?? 1);
    const isConfirmed = status === 1;
    const cashId = String(this.form.controls.idCash.value ?? '').trim();
    const bankId = String(this.form.controls.idBank.value ?? '').trim();

    if (isConfirmed && paymentType === 5 && !cashId && !bankId) {
      this.form.controls.idCash.setErrors({ required: true });
      this.form.controls.idBank.setErrors({ required: true });
      this.form.controls.idCash.markAsTouched();
      this.form.controls.idBank.markAsTouched();
      this.toast.error(
        this.translate.instant(
          'For confirmed bank/cash payments, choose at least one account (cash or bank).',
        ),
      );
      return;
    }

    const paid = Number(this.form.controls.paid.value ?? 0);
    const paidCash = Number(this.form.controls.paidCash.value ?? 0);
    const paidBank = Number(this.form.controls.paidBank.value ?? 0);

    if (paid <= 0) {
      this.toast.error(this.translate.instant('Amount must be greater than zero'));
      return;
    }

    if (!this.detailsArray.length) {
      this.toast.error(this.translate.instant('At least one detail line is required'));
      return;
    }

    const hasInvalidDetail = this.detailsArray.controls.some((line: any) => {
      const account = String(line.controls.idCounting.value ?? '').trim();
      const price = Number(line.controls.price.value ?? 0);
      return !account || !Number.isFinite(price) || price <= 0;
    });
    if (hasInvalidDetail) {
      this.toast.error(this.translate.instant('Each detail line must include account and amount'));
      return;
    }

    if (!this.isDetailsBalanced()) {
      this.toast.error(this.translate.instant('Details total must equal paid amount'));
      return;
    }

    if (paymentType === 1 && paidCash !== paid) {
      this.toast.error(this.translate.instant('For cash payment, paid cash must equal amount'));
      return;
    }

    if ([2, 3, 4].includes(paymentType) && paidBank !== paid) {
      this.toast.error(this.translate.instant('For bank payment, paid bank must equal amount'));
      return;
    }

    if (paymentType === 5 && Math.abs(paidCash + paidBank - paid) > 0.00001) {
      this.toast.error(
        this.translate.instant('For mixed payment, paid cash + paid bank must equal amount'),
      );
      return;
    }

    const raw = this.form.getRawValue() as any;
    const idCustomer = this.toOptionalPositiveInteger(raw.idCustomer);
    const idVehicle = this.toOptionalPositiveInteger(raw.idVehicle);
    const idBranch = this.toRequiredPositiveInteger(raw.idBranch);
    const idBooking = this.toOptionalPositiveInteger(raw.idBooking);
    const expenseCategory =
      Number(raw.bondType) === 1 ? this.toOptionalPositiveInteger(raw.expenseCategory) : undefined;

    if (Number(raw.bondType) === 1 && !expenseCategory) {
      this.toast.error(this.translate.instant('Expense category is required for payment voucher'));
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    if (idBranch <= 0) {
      this.toast.error(this.translate.instant('Please choose valid branch'));
      return;
    }
    const fleetId = (this.authState.fleetId() ?? '').trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('Fleet context is missing'));
      return;
    }
    const body: CreatePaymentCountRequest = {
      idCustomer,
      paid: coerceFormNumber(raw.paid),
      dscription: raw.dscription.trim(),
      idVehicle,
      idBranch,
      paymentType: raw.paymentType,
      bondType: raw.bondType,
      status: raw.status,
      idCash: [1, 5].includes(paymentType) ? raw.idCash || undefined : undefined,
      idBank: [2, 3, 4, 5].includes(paymentType) ? raw.idBank || undefined : undefined,
      paidCash: coerceFormNumber(raw.paidCash),
      paidBank: coerceFormNumber(raw.paidBank),
      expenseCategory,
      idBooking,
      stutusbooking: idBooking ? Number(raw.stutusbooking) : undefined,
      idFinancialYear: raw.idFinancialYear,
      fleetId,
      details: (raw.details as any[]).map((line: any) => ({
        idCounting: String(line.idCounting).trim(),
        price: Number(line.price ?? 0),
        node: line.node?.trim() || undefined,
        idBranch,
        idFinancialYear: raw.idFinancialYear,
      })),
    };

    this.loading.set(true);
    this.paymentCountService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Payment count created successfully'));
        this.router.navigate(['/payment-counts']);
      },
      error: err => {
        this.toast.error(this.paymentCountCreateErrorMessage(err));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private paymentCountCreateErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      const raw = err.message.replace(/^Paymentcount:\s*/i, '').trim();
      if (/error occurred while creating the paymentcount/i.test(raw)) {
        return this.translate.instant(
          'Failed to save payment count. Verify financial year, branch, payment account, and details lines.',
        );
      }
      return raw || this.translate.instant('Failed to save payment count');
    }
    return this.translate.instant('Failed to save payment count');
  }

  private loadChannels(): void {
    const fleetId = this.authState.fleetId();
    const idBranch = loginBranchId(this.authState.branchId());
    this.loadingChannels.set(true);
    forkJoin({
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cashAccounts: this.cashService.getList(fleetId, idBranch).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ banks, cashAccounts }) => {
        if (banks.length > 0 || cashAccounts.length > 0) {
          this.banks.set(banks);
          this.cashAccounts.set(cashAccounts);
          return;
        }

        forkJoin({
          banks: this.bankService.getList(null).pipe(catchError(() => of([]))),
          cashAccounts: this.cashService.getList(null, idBranch).pipe(catchError(() => of([]))),
        }).subscribe({
          next: fallback => {
            this.banks.set(fallback.banks);
            this.cashAccounts.set(fallback.cashAccounts);
          },
          complete: () => {
            this.loadingChannels.set(false);
            this.checkInitializingDone();
          },
        });
      },
      complete: () => {
        if (this.loadingChannels()) {
          this.loadingChannels.set(false);
        }
        this.checkInitializingDone();
      },
    });
  }

  private createDetailLineForm() {
    return this.fb.group({
      idCounting: ['', [Validators.required]],
      price: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0.01 })]),
      node: ['', [Validators.maxLength(250)]],
    });
  }

  private loadAccounts(): void {
    const fleetId = this.authState.fleetId();
    this.loadingAccounts.set(true);
    this.countingService.getList(fleetId).subscribe({
      next: items => {
        const active = items.filter(item => !item.isDeleted && item.isActive !== false);
        this.accounts.set(active);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load accounts'));
        this.loadingAccounts.set(false);
        this.checkInitializingDone();
      },
      complete: () => {
        this.loadingAccounts.set(false);
        this.checkInitializingDone();
      },
    });
  }

  private loadFinancialYears(): void {
    const fleetId = this.authState.fleetId();
    this.loadingFinancialYears.set(true);
    this.financialYearService.getList(fleetId).subscribe({
      next: years => {
        this.financialYears.set(years);
        const currentYear = years.find(year => year.isCurrentYear) ?? years.at(0);
        if (currentYear) {
          this.form.controls.idFinancialYear.setValue(currentYear.id, { emitEvent: false });
        }
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load financial years'));
        this.loadingFinancialYears.set(false);
        this.checkInitializingDone();
      },
      complete: () => {
        this.loadingFinancialYears.set(false);
        this.checkInitializingDone();
      },
    });
  }

  private loadCustomers(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingCustomers.set(true);
    this.customerService
      .getList({ fleetId, isActive: true })
      .subscribe({
        next: customers => this.customers.set(customers ?? []),
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load customers'));
          this.loadingCustomers.set(false);
          this.checkInitializingDone();
        },
        complete: () => {
          this.loadingCustomers.set(false);
          this.checkInitializingDone();
        },
      });
  }

  private loadVehicles(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    const branchId = Number(this.authState.branchId() ?? 0) || undefined;
    this.loadingVehicles.set(true);
    const statuses: Vehicle['status'][] = ['Available', 'Booked', 'Maintenance', 'Inactive', 'Sold'];
    forkJoin(statuses.map(status => this.vehicleService.getList({ fleetId, branchId, status })))
      .subscribe({
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
          this.checkInitializingDone();
        },
        complete: () => {
          this.loadingVehicles.set(false);
          this.checkInitializingDone();
        },
      });
  }

  private loadBranches(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingBranches.set(true);
    this.branchService
      .getList(fleetId)
      .subscribe({
        next: branches => {
          const active = (branches ?? []).filter(branch => branch.isActive !== false);
          this.branches.set(active);
          const currentBranch = Number(this.authState.branchId() ?? 0);
          const fallback = active.find(item => item.id === currentBranch) ?? active.at(0);
          if (fallback) {
            this.form.controls.idBranch.setValue(fallback.id, { emitEvent: false });
          }
        },
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load branches'));
          this.loadingBranches.set(false);
          this.checkInitializingDone();
        },
        complete: () => {
          this.loadingBranches.set(false);
          this.checkInitializingDone();
        },
      });
  }

  private loadBookings(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    const branchId = Number(this.authState.branchId() ?? 0) || undefined;
    this.loadingBookings.set(true);
    this.bookingService
      .getList({ fleetId, branchId })
      .subscribe({
        next: bookings => this.bookings.set(bookings ?? []),
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load bookings'));
          this.loadingBookings.set(false);
          this.checkInitializingDone();
        },
        complete: () => {
          this.loadingBookings.set(false);
          this.checkInitializingDone();
        },
      });
  }

  private formatBankLabel(item: Bank): string {
    const name = item.name || '-';
    const accountNumber = item.countingId || '-';
    return `${name} - ${accountNumber}`;
  }

  private formatCashLabel(item: CashAccount): string {
    const name = item.name || '-';
    const accountNumber = item.countingId || '-';
    return `${name} - ${accountNumber}`;
  }

  private formatAccountLabel(item: CountingEntry): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const name = (isArabic ? item.nameAr : item.nameEn) || item.nameAr || item.nameEn || '-';
    const number = item.countingNumber ?? '-';
    return `${number} - ${name}`;
  }

  private formatFinancialYearLabel(year: FinancialYear): string {
    const yearNumber = year.financialYearNumber != null ? String(year.financialYearNumber) : '';
    const name = year.name?.trim() || '';
    return [yearNumber, name].filter(Boolean).join(' | ') || String(year.id);
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
    return [vehicleName || '-', plate].filter(Boolean).join(' - ');
  }

  private formatBranchLabel(branch: Branch): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const name = (isArabic ? branch.nameAr : branch.nameEn) || branch.nameAr || branch.nameEn || '-';
    const code = branch.code?.trim() || '';
    return [name, code].filter(Boolean).join(' - ');
  }

  private formatBookingLabel(booking: Booking): string {
    const bookingNumber = booking.bookingNumber || booking.id || '-';
    const customer = booking.customerName || '';
    const vehicle = booking.vehiclePlateNumber || booking.vehicleName || '';
    return [bookingNumber, customer, vehicle].filter(Boolean).join(' - ');
  }

  private toRequiredPositiveInteger(value: unknown): number {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) && numeric > 0 ? Math.trunc(numeric) : 0;
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

  private toNonNegativeNumber(value: unknown): number {
    const numeric = Number(value ?? 0);
    if (!Number.isFinite(numeric)) {
      return 0;
    }
    return numeric < 0 ? 0 : numeric;
  }

  formatFlowAccount(account: CoreCountingAccountTemplate): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const accountName = isArabic ? account.nameAr : account.nameEn;
    return `${account.countingNumber} - ${accountName}`;
  }

  isCashAccountDisabled(): boolean {
    const paymentType = Number(this.form.controls.paymentType.value ?? 1);
    return ![1, 5].includes(paymentType);
  }

  isBankAccountDisabled(): boolean {
    const paymentType = Number(this.form.controls.paymentType.value ?? 1);
    return ![2, 3, 4, 5].includes(paymentType);
  }

  showCashAccountField(): boolean {
    return !this.isCashAccountDisabled();
  }

  showBankAccountField(): boolean {
    return !this.isBankAccountDisabled();
  }

  requiresCashAccount(): boolean {
    return this.statusValue() === 1 && this.paymentTypeValue() === 1;
  }

  requiresBankAccount(): boolean {
    return this.statusValue() === 1 && [2, 3, 4].includes(this.paymentTypeValue());
  }

  private applyBusinessRules(): void {
    const paymentType = Number(this.form.controls.paymentType.value ?? 1);
    const isConfirmed = Number(this.form.controls.status.value ?? 1) === 1;
    const shouldEnableCash = [1, 5].includes(paymentType);
    const shouldEnableBank = [2, 3, 4, 5].includes(paymentType);

    if (shouldEnableCash) {
      this.form.controls.idCash.enable({ emitEvent: false });
    } else {
      this.form.controls.idCash.setValue('', { emitEvent: false });
      this.form.controls.paidCash.setValue(0, { emitEvent: false });
      this.form.controls.idCash.disable({ emitEvent: false });
    }

    if (shouldEnableBank) {
      this.form.controls.idBank.enable({ emitEvent: false });
    } else {
      this.form.controls.idBank.setValue('', { emitEvent: false });
      this.form.controls.paidBank.setValue(0, { emitEvent: false });
      this.form.controls.idBank.disable({ emitEvent: false });
    }

    if (!isConfirmed) {
      this.clearAccountValidators();
      return;
    }

    if (paymentType === 1) {
      this.setControlRequired(this.form.controls.idCash, true);
      this.setControlRequired(this.form.controls.idBank, false);
      this.applySplitAmountRules('type');
      return;
    }

    if ([2, 3, 4].includes(paymentType)) {
      this.setControlRequired(this.form.controls.idCash, false);
      this.setControlRequired(this.form.controls.idBank, true);
      this.applySplitAmountRules('type');
      return;
    }

    this.setControlRequired(this.form.controls.idCash, false);
    this.setControlRequired(this.form.controls.idBank, false);
    this.applySplitAmountRules('type');
  }

  private applySplitAmountRules(trigger: 'type' | 'amount' | 'cash' | 'bank'): void {
    if (this.syncingSplitAmounts) {
      return;
    }

    const paymentType = Number(this.form.controls.paymentType.value ?? 1);
    const paidEmpty = isEmptyNumericValue(this.form.controls.paid.value);
    const paid = coerceFormNumber(this.form.controls.paid.value);
    const currentCash = coerceFormNumber(this.form.controls.paidCash.value);
    const currentBank = coerceFormNumber(this.form.controls.paidBank.value);

    this.syncingSplitAmounts = true;
    try {
      if (paymentType === 1) {
        this.form.controls.paidCash.disable({ emitEvent: false });
        this.form.controls.paidBank.disable({ emitEvent: false });
        if (paidEmpty) {
          this.setSplitAmounts(null, null);
        } else {
          this.setSplitAmounts(paid, 0);
        }
        return;
      }

      if ([2, 3, 4].includes(paymentType)) {
        this.form.controls.paidCash.disable({ emitEvent: false });
        this.form.controls.paidBank.disable({ emitEvent: false });
        if (paidEmpty) {
          this.setSplitAmounts(null, null);
        } else {
          this.setSplitAmounts(0, paid);
        }
        return;
      }

      this.form.controls.paidCash.enable({ emitEvent: false });
      this.form.controls.paidBank.enable({ emitEvent: false });

      if (trigger === 'cash') {
        const normalizedCash = Math.max(0, Math.min(currentCash, paid));
        this.setSplitAmounts(normalizedCash, Math.max(0, paid - normalizedCash));
        return;
      }

      if (trigger === 'bank') {
        const normalizedBank = Math.max(0, Math.min(currentBank, paid));
        this.setSplitAmounts(Math.max(0, paid - normalizedBank), normalizedBank);
        return;
      }

      const normalizedCash = Math.max(0, Math.min(currentCash, paid));
      this.setSplitAmounts(normalizedCash, Math.max(0, paid - normalizedCash));
    } finally {
      this.syncingSplitAmounts = false;
    }
  }

  private setSplitAmounts(cash: number | null, bank: number | null): void {
    this.form.controls.paidCash.setValue(
      cash === null ? null : Number(cash.toFixed(2)),
      { emitEvent: false },
    );
    this.form.controls.paidBank.setValue(
      bank === null ? null : Number(bank.toFixed(2)),
      { emitEvent: false },
    );
  }

  private applyBookingStatusRules(): void {
    const hasBooking = !!this.toOptionalPositiveInteger(this.form.controls.idBooking.value);
    if (hasBooking) {
      this.form.controls.stutusbooking.enable({ emitEvent: false });
      this.form.controls.stutusbooking.setValidators([Validators.required]);
      if (this.form.controls.stutusbooking.value === '') {
        this.form.controls.stutusbooking.setValue(1, { emitEvent: false });
      }
    } else {
      this.form.controls.stutusbooking.setValue('', { emitEvent: false });
      this.form.controls.stutusbooking.clearValidators();
      this.form.controls.stutusbooking.disable({ emitEvent: false });
    }
    this.form.controls.stutusbooking.updateValueAndValidity({ emitEvent: false });
  }

  private clearAccountValidators(): void {
    this.setControlRequired(this.form.controls.idCash, false);
    this.setControlRequired(this.form.controls.idBank, false);
  }

  showExpenseCategoryField(): boolean {
    return Number(this.form.controls.bondType.value ?? 1) === 1;
  }

  private applyExpenseCategoryRules(): void {
    const isPaymentVoucher = Number(this.form.controls.bondType.value ?? 1) === 1;
    if (isPaymentVoucher) {
      this.form.controls.expenseCategory.enable({ emitEvent: false });
      this.form.controls.expenseCategory.setValidators([Validators.required]);
    } else {
      this.form.controls.expenseCategory.setValue('', { emitEvent: false });
      this.form.controls.expenseCategory.clearValidators();
      this.form.controls.expenseCategory.disable({ emitEvent: false });
    }
    this.form.controls.expenseCategory.updateValueAndValidity({ emitEvent: false });
  }

  private setControlRequired(control: (typeof this.form.controls)['idCash'], required: boolean): void {
    control.setValidators(required ? [Validators.required] : []);
    control.updateValueAndValidity({ emitEvent: false });
  }

  private checkInitializingDone(): void {
    if (
      this.loadingFinancialYears() ||
      this.loadingBranches() ||
      this.loadingAccounts() ||
      this.loadingChannels() ||
      this.loadingCustomers() ||
      this.loadingVehicles() ||
      this.loadingBookings()
    ) {
      return;
    }

    this.initializing.set(false);
  }

}
