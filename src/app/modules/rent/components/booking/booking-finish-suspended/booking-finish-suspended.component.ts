import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { resolveContractPaymentBranch } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { MaintenanceByBookingSummary } from '../../../../maintenance/models/maintenance.model';
import { isMaintenanceCompletedStatus } from '../../../../maintenance/models/maintenance.normalizer';
import { MaintenanceService } from '../../../../maintenance/services/maintenance.service';
import { Bank } from '../../../../finance/models/banks/bank.model';
import { BankService } from '../../../../finance/services/banks/bank.service';
import { CashAccount } from '../../../../finance/models/cash/cash-account.model';
import { CashAccountService } from '../../../../finance/services/cash/cash-account.service';
import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import { Booking, FinshAfterSuspendedBookingRequest } from '../../../models';
import {
  bookingStatusTone,
  bookingStatusTranslationKey,
} from '../../../models/booking/booking-status.utils';
import { BookingService } from '../../../services/booking/booking.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import {
  isBookingSuspended,
  isBookingSuspendedDueToAccident,
  isBookingSuspendedDueToSumMoney,
} from '../booking-card-actions.util';
import {
  distributeSettlementByPaymentType,
  parseSettlementMoneyInput,
  resolveSettlementPaidAmounts,
  roundSettlementMoney,
  settlementMoneyInputDisplay,
  settlementTotalsMatch,
} from '../booking-settlement-payment.util';

@Component({
  selector: 'app-booking-finish-suspended',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    PageHeaderComponent,
    SmoothSelectComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './booking-finish-suspended.component.html',
  styleUrl: './booking-finish-suspended.component.scss',
})
export class BookingFinishSuspendedComponent implements OnInit {
  private static readonly BOND_TYPE_RECEIPT = 2;

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private bookingService = inject(BookingService);
  private maintenanceService = inject(MaintenanceService);
  private vehicleService = inject(VehicleService);
  private bankService = inject(BankService);
  private cashAccountService = inject(CashAccountService);
  private paymentCountService = inject(PaymentCountService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  booking = signal<Booking | null>(null);
  maintenanceSummary = signal<MaintenanceByBookingSummary | null>(null);
  maintenanceMissing = signal(false);
  vehicleBranchId = signal<number | null>(null);
  loading = signal(false);
  saving = signal(false);

  paymentMethod = signal(1);
  bankAccount = signal('');
  cashAccount = signal('');
  paidCash = signal(0);
  paidBank = signal(0);
  settlementPaidAmount = signal(0);
  private settlementUserEdited = signal(false);

  banks = signal<Bank[]>([]);
  cashAccounts = signal<CashAccount[]>([]);
  bookingsPaymentSumFromApi = signal<number | null>(null);

  isAccidentFlow = computed(() => isBookingSuspendedDueToAccident(this.booking()));

  isDebtFlow = computed(() => isBookingSuspendedDueToSumMoney(this.booking()));

  pageTitleKey = computed(() =>
    this.isAccidentFlow()
      ? 'Contract finish suspended accident title'
      : 'Contract finish suspended debt title',
  );

  paymentTypeOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Cash'), value: 1 },
    { label: this.translate.instant('Network/POS'), value: 2 },
    { label: this.translate.instant('Cheque'), value: 3 },
    { label: this.translate.instant('Bank Transfer'), value: 4 },
    { label: this.translate.instant('Bank/Cash'), value: 5 },
  ]);

  cashAccountOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select cash account'), value: '' },
    ...this.cashAccounts().map(c => ({
      label: c.name || '-',
      value: String(c.id),
    })),
  ]);

  bankAccountOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Select bank'), value: '' },
    ...this.banks().map(b => ({
      label: b.name || '-',
      value: String(b.id),
    })),
  ]);

  contractGrandTotal = computed(() => Math.max(0, Number(this.booking()?.totalAmount ?? 0) || 0));

  paymentsTotalDisplay = computed(() => {
    const fromApi = this.bookingsPaymentSumFromApi();
    if (fromApi !== null && Number.isFinite(fromApi)) {
      return Math.max(0, fromApi);
    }
    return Math.max(0, Number(this.booking()?.paidtotal ?? 0) || 0);
  });

  contractBalanceDisplay = computed(() =>
    Math.max(0, Math.round((this.contractGrandTotal() - this.paymentsTotalDisplay()) * 100) / 100),
  );

  maintenanceTotalDisplay = computed(() =>
    Math.max(0, Number(this.maintenanceSummary()?.total ?? 0) || 0),
  );

  amountDueDisplay = computed(() => {
    const contractBalance = this.contractBalanceDisplay();
    if (!this.isAccidentFlow()) {
      return contractBalance;
    }
    return Math.round((contractBalance + this.maintenanceTotalDisplay()) * 100) / 100;
  });

  maintenanceCompleted = computed(() => {
    const summary = this.maintenanceSummary();
    if (!summary) {
      return false;
    }
    return isMaintenanceCompletedStatus(summary.status);
  });

  maintenanceStatusLabelKey = computed(() => {
    const summary = this.maintenanceSummary();
    if (!summary) {
      return 'Contract finish suspended maintenance missing';
    }
    if (this.maintenanceCompleted()) {
      return 'Contract finish suspended maintenance completed';
    }
    return 'Contract finish suspended maintenance not completed';
  });

  finishSubmitBlocked = computed((): boolean => {
    if (this.finishLocked() || this.saving()) {
      return true;
    }
    if (this.isAccidentFlow()) {
      if (this.maintenanceMissing() || !this.maintenanceSummary() || !this.maintenanceCompleted()) {
        return true;
      }
    }
    return false;
  });

  constructor() {
    effect(() => {
      if (this.finishLocked()) {
        return;
      }
      if (this.settlementUserEdited()) {
        return;
      }
      const amount = this.amountDueDisplay();
      const method = this.paymentMethod();
      if (this.settlementPaidAmount() !== amount) {
        this.settlementPaidAmount.set(amount);
      }
      this.applySettlementDistribution(amount, method);
    });
  }

  ngOnInit(): void {
    const id = String(this.route.snapshot.paramMap.get('id') ?? '').trim();
    if (!id) {
      this.toast.error(this.translate.instant('Failed to load booking'));
      return;
    }
    this.loadBooking(id);
  }

  canFinishSuspended(item: Booking | null): boolean {
    return !!item && isBookingSuspended(item);
  }

  finishLocked(): boolean {
    return !this.canFinishSuspended(this.booking());
  }

  contractNumber(item: Booking): string {
    return String(item.numberBookingINBasame ?? item.bookingNumber ?? item.id ?? '').trim() || '—';
  }

  fleetDisplay(item: Booking): string {
    const name = String(item.fleetName ?? '').trim();
    return name || this.valueOrDash(item.fleetId);
  }

  statusBadgeLabelKey(status: Booking['status']): string {
    return bookingStatusTranslationKey(status);
  }

  statusBadgeTone(status: Booking['status']): 'success' | 'warning' | 'danger' | 'secondary' | 'info' {
    return bookingStatusTone(status);
  }

  valueOrDash(value: string | number | null | undefined): string {
    const s = String(value ?? '').trim();
    return s ? s : '—';
  }

  moneyOrDash(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '—';
    }
    return Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDateTime(iso: string | undefined): string {
    const t = String(iso ?? '').trim();
    if (!t) {
      return '—';
    }
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
      return t;
    }
    return d.toLocaleString(this.translate.currentLang || 'ar', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  onPaymentMethodChange(value: string): void {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1;
    this.paymentMethod.set(next);
    this.applyPaymentTypeRules(next);
    this.applySettlementDistribution(this.settlementPaidAmount(), next);
  }

  useBalanceAsSettlement(): void {
    if (this.finishLocked()) {
      return;
    }
    this.settlementUserEdited.set(false);
    const amount = this.amountDueDisplay();
    this.settlementPaidAmount.set(amount);
    this.applySettlementDistribution(amount, this.paymentMethod());
  }

  onBankChange(value: string): void {
    this.bankAccount.set(String(value ?? '').trim());
  }

  onCashChange(value: string): void {
    this.cashAccount.set(String(value ?? '').trim());
  }

  onPaidCashChange(value: string): void {
    const cash = parseSettlementMoneyInput(value);
    if (this.paymentMethod() === 5) {
      const target = this.settlementPaidAmount();
      this.paidCash.set(cash);
      this.paidBank.set(roundSettlementMoney(Math.max(0, target - cash)));
      this.settlementUserEdited.set(true);
      return;
    }
    this.paidCash.set(cash);
    this.settlementPaidAmount.set(cash);
    this.settlementUserEdited.set(true);
  }

  onPaidBankChange(value: string): void {
    const bank = parseSettlementMoneyInput(value);
    if (this.paymentMethod() === 5) {
      const target = this.settlementPaidAmount();
      this.paidBank.set(bank);
      this.paidCash.set(roundSettlementMoney(Math.max(0, target - bank)));
      this.settlementUserEdited.set(true);
      return;
    }
    this.paidBank.set(bank);
    this.settlementPaidAmount.set(bank);
    this.settlementUserEdited.set(true);
  }

  onSettlementPaidInput(value: string): void {
    if (this.finishLocked()) {
      return;
    }
    this.settlementUserEdited.set(true);
    const amount = parseSettlementMoneyInput(value);
    this.settlementPaidAmount.set(amount);
    this.applySettlementDistribution(amount, this.paymentMethod());
  }

  settlementMoneyField(value: number): string | number {
    return settlementMoneyInputDisplay(value);
  }

  paymentTypeIsCash(): boolean {
    return this.paymentMethod() === 1;
  }

  paymentTypeIsBankOnly(): boolean {
    return [2, 3, 4].includes(this.paymentMethod());
  }

  paymentTypeIsMixed(): boolean {
    return this.paymentMethod() === 5;
  }

  paymentTypeAllowsCashAccount(): boolean {
    return this.paymentMethod() === 1 || this.paymentMethod() === 5;
  }

  paymentTypeAllowsBankAccount(): boolean {
    return [2, 3, 4, 5].includes(this.paymentMethod());
  }

  submit(): void {
    const item = this.booking();
    if (!item || !this.canFinishSuspended(item)) {
      return;
    }
    if (this.isAccidentFlow()) {
      if (this.maintenanceMissing() || !this.maintenanceSummary()) {
        this.toast.error(this.translate.instant('Contract finish suspended maintenance required'));
        return;
      }
      if (!this.maintenanceCompleted()) {
        this.toast.error(this.translate.instant('Contract finish suspended maintenance not completed'));
        return;
      }
    }

    const ok = window.confirm(
      this.translate.instant(
        this.isAccidentFlow()
          ? 'Contract finish suspended accident confirm'
          : 'Contract finish suspended debt confirm',
      ),
    );
    if (!ok) {
      return;
    }

    const fleetId = this.authState.fleetId() ?? '';
    const idBooking = this.toBookingNumericId(item.id);
    if (!fleetId || !idBooking) {
      this.toast.error(this.translate.instant('Contract finish missing context'));
      return;
    }

    const paymentType = Number(this.paymentMethod()) || 1;
    const bankId = this.bankCashIdOrUndefined(this.bankAccount());
    const cashId = this.bankCashIdOrUndefined(this.cashAccount());

    const amountDue = this.amountDueDisplay();
    let settlementTarget = roundSettlementMoney(this.settlementPaidAmount());
    if (this.isDebtFlow() && amountDue > 0.009) {
      settlementTarget = amountDue;
      this.settlementPaidAmount.set(settlementTarget);
      this.applySettlementDistribution(settlementTarget, paymentType);
    }

    const resolved = resolveSettlementPaidAmounts(
      settlementTarget,
      paymentType,
      Number(this.paidCash()) || 0,
      Number(this.paidBank()) || 0,
    );
    this.paidCash.set(resolved.paidCash);
    this.paidBank.set(resolved.paidBank);

    const paidCash = resolved.paidCash;
    const paidBank = resolved.paidBank;
    const paidTotal = resolved.paidTotal;
    const settlementTotal = resolved.settlementTotal;

    if (settlementTotal > 0.009) {
      if (paymentType === 1 && !cashId) {
        this.toast.error(this.translate.instant('Contract finish cash required'));
        return;
      }
      if ([2, 3, 4].includes(paymentType) && !bankId) {
        this.toast.error(this.translate.instant('Contract finish bank required'));
        return;
      }
    }

    if (this.isDebtFlow() && amountDue > 0.009) {
      if (!settlementTotalsMatch(paidTotal, amountDue)) {
        this.toast.error(this.translate.instant('Contract finish suspended full balance required'));
        return;
      }
    }

    if (paymentType === 5) {
      if (!bankId || !cashId) {
        this.toast.error(this.translate.instant('Contract finish mixed required'));
        return;
      }
      if (paidCash <= 0 && paidBank <= 0 && settlementTotal > 0.009) {
        this.toast.error(this.translate.instant('Contract finish mixed amounts required'));
        return;
      }
    }

    if (settlementTotal > 0.009 && !settlementTotalsMatch(paidTotal, settlementTotal)) {
      this.toast.error(this.translate.instant('Paid cash and bank must equal paid amount'));
      return;
    }

    const payload: FinshAfterSuspendedBookingRequest = {
      id: idBooking,
      fleetId,
      paid: paidTotal,
      paymentType,
      bondType: BookingFinishSuspendedComponent.BOND_TYPE_RECEIPT,
      idBank: bankId,
      idCash: cashId,
      paidCash,
      paidBank,
    };

    this.saving.set(true);
    this.bookingService.finishAfterSuspended(payload).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Contract finish suspended success'));
        this.router.navigate(['/booking', item.id, 'details']);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse) {
          const msg =
            String((err.error as { message?: string })?.message ?? '').trim() ||
            String((err.error as { title?: string })?.title ?? '').trim() ||
            err.message;
          this.toast.error(msg || this.translate.instant('Contract finish suspended failed'));
          return;
        }
        this.toast.error(this.translate.instant('Contract finish suspended failed'));
      },
      complete: () => this.saving.set(false),
    });
  }

  private loadBooking(id: string): void {
    const fleetId = this.authState.fleetId() ?? '';
    if (!fleetId) {
      this.toast.error(this.translate.instant('Failed to load booking'));
      return;
    }
    this.loading.set(true);
    this.bookingService.getById(id, fleetId).subscribe({
      next: b => {
        this.loading.set(false);
        if (!b) {
          this.toast.error(this.translate.instant('Failed to load booking'));
          return;
        }
        if (!isBookingSuspended(b)) {
          this.router.navigate(['/booking', b.id, 'finish'], { replaceUrl: true });
          return;
        }
        this.booking.set(b);
        this.loadBookingsPaymentSum(b.id, fleetId);
        this.loadVehicleBranch(b, fleetId);
        if (isBookingSuspendedDueToAccident(b)) {
          this.loadMaintenanceSummary(b.id, fleetId);
        } else {
          this.maintenanceSummary.set(null);
          this.maintenanceMissing.set(false);
        }
      },
      error: () => {
        this.loading.set(false);
        this.toast.error(this.translate.instant('Failed to load booking'));
      },
    });
  }

  private loadMaintenanceSummary(bookingId: string, fleetId: string): void {
    const idBooking = this.toBookingNumericId(bookingId);
    if (!idBooking) {
      this.maintenanceSummary.set(null);
      this.maintenanceMissing.set(true);
      return;
    }
    this.maintenanceService
      .getTotalByBooking(idBooking, fleetId)
      .pipe(catchError(() => of(null)))
      .subscribe(summary => {
        if (!summary) {
          this.maintenanceSummary.set(null);
          this.maintenanceMissing.set(true);
          return;
        }
        this.maintenanceMissing.set(false);
        this.maintenanceSummary.set(summary);
      });
  }

  private loadVehicleBranch(booking: Booking, fleetId: string): void {
    const vehicleId = String(booking.vehicleId ?? '').trim();
    if (!vehicleId) {
      this.vehicleBranchId.set(null);
      this.loadLookups();
      return;
    }
    this.vehicleService.getById(vehicleId, fleetId).subscribe({
      next: vehicle => {
        const branch = Number(vehicle?.branchId ?? 0);
        this.vehicleBranchId.set(Number.isFinite(branch) && branch > 0 ? branch : null);
        this.loadLookups();
      },
      error: () => {
        this.vehicleBranchId.set(null);
        this.loadLookups();
      },
    });
  }

  private loadLookups(): void {
    const fleetId = this.authState.fleetId() ?? '';
    const branchId = resolveContractPaymentBranch({
      vehicleBranchId: this.vehicleBranchId(),
      bookingBranchId: this.booking()?.branchId,
      loginBranchId: this.authState.branchId(),
    });
    if (!fleetId) {
      return;
    }
    forkJoin({
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([] as Bank[]))),
      cash: this.cashAccountService.getList(fleetId, branchId).pipe(catchError(() => of([] as CashAccount[]))),
    }).subscribe(({ banks, cash }) => {
      this.banks.set(banks ?? []);
      this.cashAccounts.set(cash ?? []);
    });
  }

  private loadBookingsPaymentSum(bookingId: string, fleetId: string): void {
    const idBooking = this.toBookingNumericId(bookingId);
    if (!idBooking) {
      this.bookingsPaymentSumFromApi.set(null);
      return;
    }
    this.paymentCountService
      .getSumForBooking(idBooking, fleetId)
      .pipe(catchError(() => of(null)))
      .subscribe(sum => this.bookingsPaymentSumFromApi.set(sum));
  }

  private applySettlementDistribution(amount: number, type: number): void {
    const split = distributeSettlementByPaymentType(
      amount,
      type,
      Number(this.paidCash()) || 0,
      Number(this.paidBank()) || 0,
    );
    this.paidCash.set(split.paidCash);
    this.paidBank.set(split.paidBank);
  }

  private applyPaymentTypeRules(type: number): void {
    if (type === 1) {
      this.bankAccount.set('');
    } else if ([2, 3, 4].includes(type)) {
      this.cashAccount.set('');
    }
  }

  private bankCashIdOrUndefined(value: string): string | undefined {
    const v = String(value ?? '').trim();
    return v ? v : undefined;
  }

  private toBookingNumericId(id: string | number | undefined): number | null {
    const n = Number(id);
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
