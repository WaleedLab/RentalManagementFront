import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of, startWith } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import {
  CoreCountingAccountTemplate,
  VoucherAccountingPurpose,
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
    PageHeaderComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './payment-count-form.component.html',
  styleUrls: ['./payment-count-form.component.scss'],
})
export class PaymentCountFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
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

  readonly paymentTypeOptions: SmoothSelectOption[] = [
    { label: 'Cash', value: 1 },
    { label: 'Network/POS', value: 2 },
    { label: 'Cheque', value: 3 },
    { label: 'Bank Transfer', value: 4 },
    { label: 'Bank/Cash', value: 5 },
  ];

  readonly bondTypeOptions: SmoothSelectOption[] = [
    { label: 'Payment Voucher', value: 1 },
    { label: 'Receipt Voucher', value: 2 },
  ];

  readonly statusOptions: SmoothSelectOption[] = [
    { label: 'Confirmed', value: 1 },
    { label: 'Pending', value: 2 },
  ];

  readonly bookingStatusOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select booking status'), value: '' },
    { label: this.translate.instant('Confirmed'), value: 1 },
    { label: this.translate.instant('Pending'), value: 2 },
    { label: this.translate.instant('Cancelled'), value: 3 },
  ]);

  readonly accountingPurposeOptions: SmoothSelectOption[] = [
    { label: 'Rental Revenue Collection', value: 'rental_revenue' },
    { label: 'Customer Booking Advance', value: 'booking_advance' },
    { label: 'Customer Security Deposit Received', value: 'security_deposit' },
    { label: 'Customer Security Deposit Refund', value: 'security_refund' },
    { label: 'Late Fee Recognition', value: 'late_fee' },
    { label: 'Damage Fee Recognition', value: 'damage_fee' },
  ];

  form = this.fb.group({
    idCustomer: [''],
    paid: [0, [Validators.required, Validators.min(0)]],
    dscription: ['', [Validators.required, Validators.maxLength(500)]],
    idVehicle: [''],
    idBranch: [Number(this.authState.branchId() ?? 0) as number | '', [Validators.required]],
    paymentType: [1, [Validators.required, Validators.min(1)]],
    bondType: [1, [Validators.required, Validators.min(1)]],
    status: [1, [Validators.required, Validators.min(1)]],
    accountingPurpose: ['rental_revenue' as VoucherAccountingPurpose, [Validators.required]],
    idFinancialYear: ['', [Validators.required]],
    idCash: [''],
    idBank: [''],
    paidCash: [0, [Validators.required, Validators.min(0)]],
    paidBank: [0, [Validators.required, Validators.min(0)]],
    idBooking: [''],
    stutusbooking: [1 as number | '', [Validators.required]],
    details: this.fb.array([this.createDetailLineForm()]),
  });

  readonly selectedCollectionChannel = computed<VoucherCollectionChannel>(() =>
    Number(this.form.controls.paymentType.value) === 1 ? 'cash' : 'bank',
  );

  readonly suggestedVoucherFlow = computed(() =>
    resolveVoucherFlow(this.form.controls.accountingPurpose.value, this.selectedCollectionChannel()),
  );

  get detailsArray() {
    return this.form.controls.details;
  }

  ngOnInit(): void {
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

    this.loadCustomers();
    this.loadVehicles();
    this.loadBranches();
    this.loadBookings();
    this.loadFinancialYears();
    this.loadAccounts();
    this.loadChannels();
    this.applySplitAmountRules('type');
    this.applyBookingStatusRules();
  }

  addLine(): void {
    this.detailsArray.push(this.createDetailLineForm());
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
    return this.detailsArray.controls.reduce((total, line) => {
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

  onSubmit(): void {
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

    const hasInvalidDetail = this.detailsArray.controls.some(line => {
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

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const idCustomer = this.toOptionalPositiveInteger(raw.idCustomer);
    const idVehicle = this.toOptionalPositiveInteger(raw.idVehicle);
    const idBranch = this.toRequiredPositiveInteger(raw.idBranch);
    const idBooking = this.toOptionalPositiveInteger(raw.idBooking);
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
      paid: raw.paid,
      dscription: raw.dscription.trim(),
      idVehicle,
      idBranch,
      paymentType: raw.paymentType,
      bondType: raw.bondType,
      status: raw.status,
      idCash: raw.idCash || undefined,
      idBank: raw.idBank || undefined,
      paidCash: raw.paidCash,
      paidBank: raw.paidBank,
      idBooking,
      stutusbooking: idBooking ? Number(raw.stutusbooking) : undefined,
      idFinancialYear: raw.idFinancialYear,
      fleetId,
      details: raw.details.map(line => ({
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
        this.toast.error(err?.message ?? this.translate.instant('Failed to save payment count'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private loadChannels(): void {
    const fleetId = this.authState.fleetId();
    this.loadingChannels.set(true);
    forkJoin({
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cashAccounts: this.cashService.getList(fleetId).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ banks, cashAccounts }) => {
        if (banks.length > 0 || cashAccounts.length > 0) {
          this.banks.set(banks);
          this.cashAccounts.set(cashAccounts);
          return;
        }

        forkJoin({
          banks: this.bankService.getList(null).pipe(catchError(() => of([]))),
          cashAccounts: this.cashService.getList(null).pipe(catchError(() => of([]))),
        }).subscribe({
          next: fallback => {
            this.banks.set(fallback.banks);
            this.cashAccounts.set(fallback.cashAccounts);
          },
          complete: () => this.loadingChannels.set(false),
        });
      },
      complete: () => {
        if (this.loadingChannels()) {
          this.loadingChannels.set(false);
        }
      },
    });
  }

  private createDetailLineForm() {
    return this.fb.group({
      idCounting: ['', [Validators.required]],
      price: [0, [Validators.required, Validators.min(0.01)]],
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
      },
      complete: () => this.loadingAccounts.set(false),
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
      },
      complete: () => this.loadingFinancialYears.set(false),
    });
  }

  private loadCustomers(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingCustomers.set(true);
    this.customerService
      .getPaginated({ fleetId, pageNumber: 1, pageSize: 100, search: '', isActive: true })
      .subscribe({
        next: response => this.customers.set(response.items ?? []),
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
      .getPaginated({ fleetId, branchId, pageNumber: 1, pageSize: 100, search: '', status: '' })
      .subscribe({
        next: response => this.vehicles.set(response.items ?? []),
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load vehicles'));
          this.loadingVehicles.set(false);
        },
        complete: () => this.loadingVehicles.set(false),
      });
  }

  private loadBranches(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingBranches.set(true);
    this.branchService
      .getPaginated({ fleetId, pageNumber: 1, pageSize: 200, search: '' })
      .subscribe({
        next: response => {
          const active = (response.items ?? []).filter(branch => branch.isActive !== false);
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
        },
        complete: () => this.loadingBranches.set(false),
      });
  }

  private loadBookings(): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    const branchId = Number(this.authState.branchId() ?? 0) || undefined;
    this.loadingBookings.set(true);
    this.bookingService
      .getPaginated({ fleetId, branchId, pageNumber: 1, pageSize: 100, search: '' })
      .subscribe({
        next: response => this.bookings.set(response.items ?? []),
        error: err => {
          this.toast.error(err?.message ?? this.translate.instant('Failed to load bookings'));
          this.loadingBookings.set(false);
        },
        complete: () => this.loadingBookings.set(false),
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
    const paid = this.toNonNegativeNumber(this.form.controls.paid.value);
    const currentCash = this.toNonNegativeNumber(this.form.controls.paidCash.value);
    const currentBank = this.toNonNegativeNumber(this.form.controls.paidBank.value);

    this.syncingSplitAmounts = true;
    try {
      if (paymentType === 1) {
        this.form.controls.paidCash.disable({ emitEvent: false });
        this.form.controls.paidBank.disable({ emitEvent: false });
        this.setSplitAmounts(paid, 0);
        return;
      }

      if ([2, 3, 4].includes(paymentType)) {
        this.form.controls.paidCash.disable({ emitEvent: false });
        this.form.controls.paidBank.disable({ emitEvent: false });
        this.setSplitAmounts(0, paid);
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

  private setSplitAmounts(cash: number, bank: number): void {
    this.form.controls.paidCash.setValue(Number(cash.toFixed(2)), { emitEvent: false });
    this.form.controls.paidBank.setValue(Number(bank.toFixed(2)), { emitEvent: false });
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

  private setControlRequired(control: (typeof this.form.controls)['idCash'], required: boolean): void {
    control.setValidators(required ? [Validators.required] : []);
    control.updateValueAndValidity({ emitEvent: false });
  }

}
