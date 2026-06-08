import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { resolveContractPaymentBranch } from '../../../../../shared/utils/branch-id.util';
import { ConfirmService } from '../../../../../shared/services/confirm.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { Bank } from '../../../../finance/models/banks/bank.model';
import { BankService } from '../../../../finance/services/banks/bank.service';
import { CashAccount } from '../../../../finance/models/cash/cash-account.model';
import { CashAccountService } from '../../../../finance/services/cash/cash-account.service';
import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import { Booking, CloseBookingRequest, Setting } from '../../../models';
import {
  bookingStatusTone,
  bookingStatusTranslationKey,
} from '../../../models/booking/booking-status.utils';
import { BookingService } from '../../../services/booking/booking.service';
import { SettingService } from '../../../services/settings/setting.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import {
  distributeSettlementByPaymentType,
  parseSettlementMoneyInput,
  roundSettlementMoney,
  settlementMoneyInputDisplay,
} from '../booking-settlement-payment.util';
import {
  CloseRulesInput,
  CloseRulesSettings,
  closeMinutesGraceViolated,
  closeReturnSameDayViolated,
  drivenKmForClose,
  kmCloseViolated,
  minutesLateForClose,
  resolveCheckoutMs,
} from './booking-close-rules.util';
import {
  bookingCheckoutOdometer,
  isReturnOdometerAboveCheckout,
  parseReturnDateTimeLocalMs,
  parseReturnOdometerInput,
  validateReturnAgainstCheckout,
} from '../booking-return-checkout.util';

@Component({
  selector: 'app-booking-close',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    TranslateModule,
    DatePickerComponent,
    SmoothSelectComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './booking-close.component.html',
  styleUrl: './booking-close.component.scss',
})
export class BookingCloseComponent implements OnInit {
  private static readonly CLOSE_WORKFLOW_SECTION_IDS = [
    'close-form-section-summary',
    'close-form-section-return',
    'close-form-section-refund',
    'close-form-section-notes',
  ] as const;

  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private bookingService = inject(BookingService);
  private vehicleService = inject(VehicleService);
  private bankService = inject(BankService);
  private cashAccountService = inject(CashAccountService);
  private paymentCountService = inject(PaymentCountService);
  private settingService = inject(SettingService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private confirmService = inject(ConfirmService);

  booking = signal<Booking | null>(null);
  vehicleBranchId = signal<number | null>(null);
  settings = signal<Setting | null>(null);
  loading = signal(false);
  saving = signal(false);

  returnDateTime = signal('');
  returnOdometerText = signal('');
  notes = signal('');
  /** Non-null when the warning modal should show (plain translated text). */
  warningMessage = signal<string | null>(null);

  paymentMethod = signal(1);
  bankAccount = signal('');
  cashAccount = signal('');
  paidCash = signal(0);
  paidBank = signal(0);
  /** Refund amount sent as `Paid` on close (backend creates payment voucher when positive). */
  refundAmount = signal(0);
  private refundUserEdited = signal(false);

  banks = signal<Bank[]>([]);
  cashAccounts = signal<CashAccount[]>([]);
  bookingsPaymentSumFromApi = signal<number | null>(null);

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

  closeSummarySectionComplete = computed(() => !!this.booking());

  closeReturnSectionComplete = computed(
    () =>
      this.odometerKmTestPassed() &&
      this.returnTimeAfterCheckoutPassed() &&
      this.closeReturnSameDayPassed() &&
      this.closeMinutesGracePassed(),
  );

  closeRefundSectionComplete = computed((): boolean => {
    const amount = roundSettlementMoney(this.refundAmount());
    if (amount <= 0) {
      return true;
    }
    const type = Number(this.paymentMethod()) || 1;
    const bankId = String(this.bankAccount() ?? '').trim();
    const cashId = String(this.cashAccount() ?? '').trim();
    const paidCash = Math.max(0, Number(this.paidCash()) || 0);
    const paidBank = Math.max(0, Number(this.paidBank()) || 0);
    const paidTotal = roundSettlementMoney(paidCash + paidBank);
    if (paidTotal !== amount) {
      return false;
    }
    if (type === 1) {
      return !!cashId;
    }
    if ([2, 3, 4].includes(type)) {
      return !!bankId;
    }
    if (type === 5) {
      return !!bankId && !!cashId && (paidCash > 0 || paidBank > 0);
    }
    return true;
  });

  closeNotesSectionComplete = computed(() => true);

  closeFormCompletionPercent = computed((): number => {
    let done = 0;
    if (this.closeSummarySectionComplete()) done++;
    if (this.closeReturnSectionComplete()) done++;
    if (this.closeRefundSectionComplete()) done++;
    if (this.closeNotesSectionComplete()) done++;
    return Math.round((done / 4) * 100);
  });

  closeCurrentWorkflowStep = computed((): number => {
    if (!this.closeSummarySectionComplete()) {
      return 1;
    }
    if (!this.closeReturnSectionComplete()) {
      return 2;
    }
    if (!this.closeRefundSectionComplete()) {
      return 3;
    }
    if (!this.closeNotesSectionComplete()) {
      return 4;
    }
    return 5;
  });

  closeSubmitBlocked = computed(
    () =>
      this.closeLocked() ||
      this.saving() ||
      this.closeDisabledReason() !== null ||
      !this.closeRefundSectionComplete(),
  );

  focusCloseWorkflowSection(step: 1 | 2 | 3 | 4): void {
    const sectionId = BookingCloseComponent.CLOSE_WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }
    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('finish-form-section--focus');
    window.setTimeout(() => section.classList.remove('finish-form-section--focus'), 1400);
  }

  contractNumber(item: Booking): string {
    return (
      String(item.numberBookingINBasame ?? item.bookingNumber ?? item.id ?? '').trim() || '—'
    );
  }

  statusBadgeLabelKey(status: Booking['status']): string {
    return bookingStatusTranslationKey(status);
  }

  statusBadgeTone(status: Booking['status']): 'success' | 'warning' | 'danger' | 'secondary' | 'info' {
    return bookingStatusTone(status);
  }

  /** Paid total from payment-counts sum API, else booking `paidtotal`. */
  paymentsTotalDisplay = computed(() => {
    const fromApi = this.bookingsPaymentSumFromApi();
    if (fromApi !== null && fromApi !== undefined && Number.isFinite(fromApi)) {
      return Math.max(0, fromApi);
    }
    const b = this.booking();
    return Math.max(0, Number(b?.paidtotal ?? b?.paidAmount ?? 0) || 0);
  });

  constructor() {
    effect(() => {
      if (this.closeLocked()) {
        return;
      }
      this.paymentsTotalDisplay();
      if (this.refundUserEdited()) {
        return;
      }
      const amount = this.paymentsTotalDisplay();
      if (this.refundAmount() !== amount) {
        this.refundAmount.set(amount);
      }
      this.applyRefundDistribution(amount, this.paymentMethod());
    });
  }

  ngOnInit(): void {
    const id = String(this.route.snapshot.paramMap.get('id') ?? '').trim();
    if (!id) {
      this.toast.error(this.translate.instant('Failed to load booking'));
      return;
    }
    this.load(id);
  }

  canClose(item: Booking | null): boolean {
    if (!item) {
      return false;
    }
    return item.status !== 'finsh' && item.status !== 'close';
  }

  closeLocked(): boolean {
    return !this.canClose(this.booking());
  }

  pageSubtitle(item: Booking): string {
    return this.translate.instant('Contract details subtitle', {
      branch: this.valueOrDash(item.branchName),
      fleet: this.fleetDisplay(item),
      ref: this.valueOrDash(item.bookingNumber || item.id),
    });
  }

  fleetDisplay(item: Booking): string {
    const name = String(item.fleetName ?? '').trim();
    return name || this.valueOrDash(item.fleetId);
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

  numberOrDash(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '—';
    }
    return String(value);
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

  checkoutTimeDisplay(item: Booking): string {
    const pickup = String(item.pickupDate ?? '').trim();
    if (pickup) {
      return this.formatDateTime(pickup);
    }
    return this.formatDateTime(item.startDate);
  }

  paymentDisplay(item: Booking): string {
    const paid = item.paidtotal ?? item.paidAmount;
    if (paid === null || paid === undefined || Number.isNaN(Number(paid))) {
      return '—';
    }
    return this.moneyOrDash(paid);
  }

  allowedCloseMinutes(): number {
    const s = this.settings();
    return Math.max(0, Number(s?.number_mints_late_forr_finshcontract) || 0);
  }

  allowedCloseKmMargin(): number {
    const s = this.settings();
    return Math.max(0, Number(s?.number_incres_km_for_finshcontract) || 0);
  }

  parsedReturnOdometer(): number | null {
    return parseReturnOdometerInput(this.returnOdometerText());
  }

  private closeRulesSettings(s: Setting | null): CloseRulesSettings {
    return {
      allowedLateMinutes: Math.max(0, Number(s?.number_mints_late_forr_finshcontract) || 0),
      allowedDrivenKm: Math.max(0, Number(s?.number_incres_km_for_finshcontract) || 0),
    };
  }

  private parsedReturnMs(): number | null {
    return parseReturnDateTimeLocalMs(this.returnDateTime());
  }

  private buildCloseRulesInputForForm(item: Booking): CloseRulesInput | null {
    const returnMs = this.parsedReturnMs();
    const returnOdom = this.parsedReturnOdometer();
    if (returnMs === null || returnOdom === null) {
      return null;
    }
    return this.buildCloseRulesInput(item, returnMs, returnOdom);
  }

  private buildCloseRulesInput(
    item: Booking,
    returnMs: number,
    returnOdom: number,
  ): CloseRulesInput | null {
    const checkoutMs = resolveCheckoutMs(item.startDate, item.pickupDate);
    if (checkoutMs === null) {
      return null;
    }
    return {
      checkoutMs,
      returnMs,
      checkoutOdom: Math.max(0, Math.trunc(Number(item.checkoutCounter) || 0)),
      returnOdom,
    };
  }

  closeDisabledReason = computed(():
    | 'locked'
    | 'invalid_odom'
    | 'invalid_return_time'
    | 'return_not_same_day'
    | 'time_grace_exceeded'
    | 'settings_missing'
    | null => {
    const item = this.booking();
    if (!item || !this.canClose(item)) {
      return 'locked';
    }
    if (!this.settings()) {
      return 'settings_missing';
    }
    if (!this.odometerKmTestPassed()) {
      return 'invalid_odom';
    }
    if (!this.returnTimeAfterCheckoutPassed()) {
      return 'invalid_return_time';
    }
    if (!this.closeReturnSameDayPassed()) {
      return 'return_not_same_day';
    }
    if (!this.closeMinutesGracePassed()) {
      return 'time_grace_exceeded';
    }
    return null;
  });

  closeReturnSameDayPassed = computed((): boolean => {
    const item = this.booking();
    if (!item) {
      return false;
    }
    const rules = this.buildCloseRulesInputForForm(item);
    if (!rules) {
      return false;
    }
    return !closeReturnSameDayViolated(rules.checkoutMs, rules.returnMs);
  });

  closeMinutesGracePassed = computed((): boolean => {
    const item = this.booking();
    const s = this.settings();
    if (!item || !s) {
      return false;
    }
    const rules = this.buildCloseRulesInputForForm(item);
    if (!rules) {
      return false;
    }
    return !closeMinutesGraceViolated(rules, this.closeRulesSettings(s));
  });

  returnTimeAfterCheckoutPassed = computed((): boolean => {
    const item = this.booking();
    if (!item) {
      return false;
    }
    return validateReturnAgainstCheckout(
      item,
      this.returnOdometerText(),
      this.returnDateTime(),
    ).timeOk;
  });

  /** Return odometer above checkout and within km close margin from fleet settings. */
  odometerKmTestPassed = computed((): boolean => {
    const item = this.booking();
    if (!item) {
      return false;
    }
    const ret = this.parsedReturnOdometer();
    if (ret === null) {
      return false;
    }
    const exit = bookingCheckoutOdometer(item);
    if (!isReturnOdometerAboveCheckout(ret, exit)) {
      return false;
    }
    const rules = this.buildCloseRulesInputForForm(item);
    const s = this.settings();
    if (!rules || !s) {
      return true;
    }
    return !kmCloseViolated(rules, this.closeRulesSettings(s));
  });

  returnDatePickerDisabled = computed(
    () => this.closeLocked() || !this.odometerKmTestPassed(),
  );

  odometerKmViolationHint = computed((): string | null => {
    const item = this.booking();
    if (!item || this.closeLocked()) {
      return null;
    }
    const ret = this.parsedReturnOdometer();
    if (ret === null) {
      return null;
    }
    const exit = bookingCheckoutOdometer(item);
    if (!isReturnOdometerAboveCheckout(ret, exit)) {
      return this.translate.instant('Contract close odometer below checkout short');
    }
    const rules = this.buildCloseRulesInputForForm(item);
    const s = this.settings();
    if (!rules || !s || !kmCloseViolated(rules, this.closeRulesSettings(s))) {
      return null;
    }
    const driven = drivenKmForClose(rules.checkoutOdom, rules.returnOdom);
    return this.translate.instant('Contract close warning km detail', {
      drivenKm: driven,
      allowedKm: this.allowedCloseKmMargin(),
    });
  });

  returnDateViolationHint = computed((): string | null => {
    const item = this.booking();
    if (!item || this.closeLocked() || !this.odometerKmTestPassed()) {
      return null;
    }
    const v = validateReturnAgainstCheckout(
      item,
      this.returnOdometerText(),
      this.returnDateTime(),
    );
    if (!v.timeOk && v.checkoutMs !== null) {
      return this.translate.instant('Contract finish return before checkout');
    }
    const rules = this.buildCloseRulesInputForForm(item);
    const s = this.settings();
    if (!rules || !s) {
      return null;
    }
    if (closeReturnSameDayViolated(rules.checkoutMs, rules.returnMs)) {
      return this.translate.instant('Contract close same day required detail', {
        checkoutTime: this.checkoutTimeDisplay(item),
        returnTime: this.formatDateTime(this.dateTimeLocalToApi(this.returnDateTime())),
      });
    }
    const settings = this.closeRulesSettings(s);
    if (!closeMinutesGraceViolated(rules, settings)) {
      return null;
    }
    return this.translate.instant('Contract close warning time detail', {
      checkoutTime: this.checkoutTimeDisplay(item),
      returnTime: this.formatDateTime(this.dateTimeLocalToApi(this.returnDateTime())),
      lateMinutes: Math.ceil(minutesLateForClose(rules)),
      allowedMinutes: settings.allowedLateMinutes,
    });
  });

  dismissWarning(): void {
    this.warningMessage.set(null);
  }

  onReturnDateChange(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }
    this.returnDateTime.set(String(value ?? ''));
  }

  onReturnOdometerInput(value: string): void {
    this.returnOdometerText.set(String(value ?? ''));
  }

  onNotesInput(value: string): void {
    this.notes.set(String(value ?? ''));
  }

  onPaymentMethodChange(value: string): void {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1;
    this.paymentMethod.set(next);
    this.applyPaymentTypeRules(next);
    this.applyRefundDistribution(this.refundAmount(), next);
  }

  useFullPaidAsRefund(): void {
    if (this.closeLocked()) {
      return;
    }
    this.refundUserEdited.set(false);
    const amount = this.paymentsTotalDisplay();
    this.refundAmount.set(amount);
    this.applyRefundDistribution(amount, this.paymentMethod());
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
      const target = this.refundAmount();
      this.paidCash.set(cash);
      this.paidBank.set(roundSettlementMoney(Math.max(0, target - cash)));
      this.refundUserEdited.set(true);
      return;
    }
    this.paidCash.set(cash);
    this.refundAmount.set(cash);
    this.refundUserEdited.set(true);
  }

  onPaidBankChange(value: string): void {
    const bank = parseSettlementMoneyInput(value);
    if (this.paymentMethod() === 5) {
      const target = this.refundAmount();
      this.paidBank.set(bank);
      this.paidCash.set(roundSettlementMoney(Math.max(0, target - bank)));
      this.refundUserEdited.set(true);
      return;
    }
    this.paidBank.set(bank);
    this.refundAmount.set(bank);
    this.refundUserEdited.set(true);
  }

  onRefundAmountInput(value: string): void {
    if (this.closeLocked()) {
      return;
    }
    this.refundUserEdited.set(true);
    const amount = parseSettlementMoneyInput(value);
    this.refundAmount.set(amount);
    this.applyRefundDistribution(amount, this.paymentMethod());
  }

  refundMoneyField(value: number): string | number {
    return settlementMoneyInputDisplay(value);
  }

  paymentTypeAllowsCashAccount(): boolean {
    return this.paymentMethod() === 1 || this.paymentMethod() === 5;
  }

  paymentTypeAllowsBankAccount(): boolean {
    return [2, 3, 4, 5].includes(this.paymentMethod());
  }

  submit(): void {
    const item = this.booking();
    const s = this.settings();
    if (!item || !this.canClose(item)) {
      return;
    }
    if (!s) {
      this.toast.error(this.translate.instant('Contract close settings required'));
      return;
    }
    const validation = validateReturnAgainstCheckout(
      item,
      this.returnOdometerText(),
      this.returnDateTime(),
    );
    if (validation.returnOdom === null) {
      this.toast.error(this.translate.instant('Contract close odometer required'));
      return;
    }
    if (!validation.odometerOk) {
      this.toast.error(this.translate.instant('Contract close odometer below checkout'));
      return;
    }

    const returnIso = this.dateTimeLocalToApi(this.returnDateTime());
    if (!returnIso) {
      this.toast.error(this.translate.instant('Contract close return time invalid'));
      return;
    }
    const returnMs = validation.returnMs ?? parseReturnDateTimeLocalMs(this.returnDateTime());
    if (returnMs === null) {
      this.toast.error(this.translate.instant('Contract close return time invalid'));
      return;
    }
    const rules = this.buildCloseRulesInput(item, returnMs, validation.returnOdom);
    if (!rules) {
      this.toast.error(this.translate.instant('Contract finish missing context'));
      return;
    }
    if (!validation.timeOk) {
      this.toast.error(this.translate.instant('Contract finish return before checkout'));
      return;
    }

    const parts: string[] = this.buildCloseWarningMessages(item, s, rules);
    if (parts.length > 0) {
      this.warningMessage.set(parts.join('\n\n'));
      return;
    }

    this.confirmService
      .confirm(
        this.translate.instant('Contract close confirm title'),
        this.translate.instant('Contract close confirm'),
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }
        this.executeCloseSubmit(item, returnIso, validation);
      });
  }

  private executeCloseSubmit(
    item: Booking,
    returnIso: string,
    validation: ReturnType<typeof validateReturnAgainstCheckout>,
  ): void {
    const checkinCounter = validation.returnOdom;
    if (checkinCounter === null) {
      this.toast.error(this.translate.instant('Contract close odometer required'));
      return;
    }

    const fleetId = this.authState.fleetId() ?? '';
    const idBooking = this.toBookingNumericId(item.id);
    const idBranch = resolveContractPaymentBranch({
      vehicleBranchId: this.vehicleBranchId(),
      bookingBranchId: item.branchId,
      loginBranchId: this.authState.branchId(),
    });
    if (!fleetId || !idBooking || !Number.isFinite(idBranch) || idBranch <= 0) {
      this.toast.error(this.translate.instant('Contract finish missing context'));
      return;
    }

    const idCustomer = this.toBookingNumericId(item.customerId);
    const idVehicle = this.toBookingNumericId(item.vehicleId);
    if (!idCustomer || !idVehicle) {
      this.toast.error(this.translate.instant('Contract finish missing ids'));
      return;
    }

    const paymentType = Number(this.paymentMethod()) || 1;
    const bankId = this.bankCashIdOrUndefined(this.bankAccount());
    const cashId = this.bankCashIdOrUndefined(this.cashAccount());
    const paidCash = Math.max(0, Number(this.paidCash()) || 0);
    const paidBank = Math.max(0, Number(this.paidBank()) || 0);
    const paidTotal = roundSettlementMoney(paidCash + paidBank);
    const refundTotal = roundSettlementMoney(this.refundAmount());

    if (refundTotal > 0) {
      if (paymentType === 1 && !cashId) {
        this.toast.error(this.translate.instant('Contract finish cash required'));
        return;
      }
      if ([2, 3, 4].includes(paymentType) && !bankId) {
        this.toast.error(this.translate.instant('Contract finish bank required'));
        return;
      }
      if (paymentType === 5) {
        if (!bankId || !cashId) {
          this.toast.error(this.translate.instant('Contract finish mixed required'));
          return;
        }
        if (paidCash <= 0 && paidBank <= 0) {
          this.toast.error(this.translate.instant('Contract finish mixed amounts required'));
          return;
        }
        if (!bankId && paidBank > 0) {
          this.toast.error(this.translate.instant('Contract finish bank required'));
          return;
        }
        if (!cashId && paidCash > 0) {
          this.toast.error(this.translate.instant('Contract finish cash required'));
          return;
        }
        if (paidTotal !== refundTotal) {
          this.toast.error(this.translate.instant('Paid cash and bank must equal paid amount'));
          return;
        }
      }
      if (paidTotal !== refundTotal) {
        this.toast.error(this.translate.instant('Paid cash and bank must equal paid amount'));
        return;
      }
    }

    const payload: CloseBookingRequest = {
      id: idBooking,
      idCustomer,
      idVehicle,
      idBranch,
      fleetId,
      dateReturnVehical: returnIso,
      note: this.notes().trim() || undefined,
      checkinCounter,
      paid: refundTotal,
      paymentType,
    };
    if (refundTotal > 0) {
      if (bankId) {
        payload.idBank = bankId;
      }
      if (cashId) {
        payload.idCash = cashId;
      }
      payload.paidCash = paidCash;
      payload.paidBank = paidBank;
    }

    this.saving.set(true);
    this.bookingService.close(payload).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Contract close success'));
        this.router.navigate(['/booking', 'details', item.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse) {
          const msg =
            String((err.error as { message?: string })?.message ?? '').trim() ||
            String((err.error as { title?: string })?.title ?? '').trim() ||
            err.message;
          this.toast.error(msg || this.translate.instant('Contract close failed'));
          return;
        }
        this.toast.error(this.translate.instant('Contract close failed'));
      },
      complete: () => this.saving.set(false),
    });
  }

  private load(id: string): void {
    const fleetId = this.authState.fleetId() ?? '';
    if (!fleetId) {
      this.toast.error(this.translate.instant('Failed to load booking'));
      return;
    }
    this.loading.set(true);
    forkJoin({
      booking: this.bookingService.getById(id, fleetId).pipe(catchError(() => of(null))),
      settings: this.settingService.getCurrent(fleetId).pipe(catchError(() => of(null))),
    }).subscribe(({ booking: b, settings: st }) => {
      this.loading.set(false);
      if (!b) {
        this.toast.error(this.translate.instant('Failed to load booking'));
        this.vehicleBranchId.set(null);
        return;
      }
      this.booking.set(b);
      this.settings.set(st);
      this.patchPaymentFromBooking(b);
      this.loadBookingsPaymentSum(b.id, fleetId);
      this.loadVehicleBranch(b, fleetId);
      const existing = Number(b.checkinCounter);
      if (Number.isFinite(existing) && existing > 0) {
        this.returnOdometerText.set(String(Math.trunc(existing)));
      } else {
        this.returnOdometerText.set('');
      }
      this.notes.set(String(b.notes ?? ''));
      this.returnDateTime.set(this.initialReturnDateTimeLocal(b));
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

  private loadBookingsPaymentSum(bookingId: string, fleetId: string): void {
    const idBooking = this.toBookingNumericId(bookingId);
    if (!idBooking) {
      this.bookingsPaymentSumFromApi.set(null);
      return;
    }
    this.bookingsPaymentSumFromApi.set(null);
    this.paymentCountService
      .getSumForBooking(idBooking, fleetId)
      .pipe(catchError(() => of(null)))
      .subscribe(sum => {
        this.bookingsPaymentSumFromApi.set(sum);
      });
  }

  private patchPaymentFromBooking(b: Booking): void {
    const ext = b as Booking & {
      paymentType?: number;
      idBank?: string;
      idCash?: string;
      paidCash?: number;
      paidBank?: number;
    };
    const pt = Number(ext.paymentType);
    this.paymentMethod.set(Number.isFinite(pt) && pt >= 1 && pt <= 5 ? pt : 1);
    this.bankAccount.set(String(ext.idBank ?? '').trim());
    this.cashAccount.set(String(ext.idCash ?? '').trim());
    this.paidCash.set(Math.max(0, Number(ext.paidCash ?? 0) || 0));
    this.paidBank.set(Math.max(0, Number(ext.paidBank ?? 0) || 0));
    this.refundUserEdited.set(false);
    this.refundAmount.set(0);
    this.applyPaymentTypeRules(this.paymentMethod());
  }

  private loadLookups(): void {
    const fleetId = this.authState.fleetId() || undefined;
    const idBranch = resolveContractPaymentBranch({
      vehicleBranchId: this.vehicleBranchId(),
      bookingBranchId: this.booking()?.branchId,
      loginBranchId: this.authState.branchId(),
    });
    forkJoin({
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cashAccounts: this.cashAccountService.getList(fleetId, idBranch).pipe(catchError(() => of([]))),
    }).subscribe(({ banks, cashAccounts }) => {
      this.banks.set(banks ?? []);
      this.cashAccounts.set(cashAccounts ?? []);
      this.applyPaymentTypeRules(this.paymentMethod());
    });
  }

  private applyPaymentTypeRules(type: number): void {
    const banksList = this.banks();
    const cashList = this.cashAccounts();
    const firstBankId = banksList.length > 0 ? String(banksList[0].id ?? '').trim() : '';
    const firstCashId = cashList.length > 0 ? String(cashList[0].id ?? '').trim() : '';

    if (type === 1) {
      this.bankAccount.set('');
      if (!this.cashAccount() && firstCashId) {
        this.cashAccount.set(firstCashId);
      }
      this.paidBank.set(0);
      return;
    }

    if ([2, 3, 4].includes(type)) {
      this.cashAccount.set('');
      if (!this.bankAccount() && firstBankId) {
        this.bankAccount.set(firstBankId);
      }
      this.paidCash.set(0);
      return;
    }

    if (!this.bankAccount() && firstBankId) {
      this.bankAccount.set(firstBankId);
    }
    if (!this.cashAccount() && firstCashId) {
      this.cashAccount.set(firstCashId);
    }
  }

  private applyRefundDistribution(amount: number, type: number): void {
    const split = distributeSettlementByPaymentType(
      amount,
      type,
      Number(this.paidCash()) || 0,
      Number(this.paidBank()) || 0,
    );
    this.paidCash.set(split.paidCash);
    this.paidBank.set(split.paidBank);
  }

  private bankCashIdOrUndefined(value: string): string | undefined {
    const s = String(value ?? '').trim().replace(/^\{|\}$/g, '');
    return s ? s : undefined;
  }

  private buildCloseWarningMessages(
    item: Booking,
    s: Setting,
    rules: CloseRulesInput,
  ): string[] {
    const parts: string[] = [];
    const settings = this.closeRulesSettings(s);
    if (kmCloseViolated(rules, settings)) {
      parts.push(
        this.translate.instant('Contract close warning km detail', {
          drivenKm: drivenKmForClose(rules.checkoutOdom, rules.returnOdom),
          allowedKm: settings.allowedDrivenKm,
        }),
      );
    }
    if (closeReturnSameDayViolated(rules.checkoutMs, rules.returnMs)) {
      parts.push(
        this.translate.instant('Contract close same day required detail', {
          checkoutTime: this.checkoutTimeDisplay(item),
          returnTime: this.formatDateTime(this.dateTimeLocalToApi(this.returnDateTime())),
        }),
      );
    } else if (closeMinutesGraceViolated(rules, settings)) {
      parts.push(
        this.translate.instant('Contract close warning time detail', {
          checkoutTime: this.checkoutTimeDisplay(item),
          returnTime: this.formatDateTime(this.dateTimeLocalToApi(this.returnDateTime())),
          lateMinutes: Math.ceil(minutesLateForClose(rules)),
          allowedMinutes: settings.allowedLateMinutes,
        }),
      );
    }
    return parts;
  }

  /** Actual return at close — defaults to now; saved as `dateReturnVehical` (not end date). */
  private initialReturnDateTimeLocal(_b: Booking): string {
    return this.nowDateTimeLocalValue();
  }

  private toDateTimeLocalValue(iso: string | undefined): string {
    const text = String(iso ?? '').trim();
    if (!text) {
      return '';
    }
    const d = new Date(text);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  private dateTimeLocalToApi(value: string): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(text)) {
      return `${text}:00`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(text)) {
      return text;
    }
    const d = new Date(text);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  private nowDateTimeLocalValue(): string {
    return this.toDateTimeLocalValue(new Date().toISOString());
  }

  private parseReturnDateTimeMs(value: string): number | null {
    const text = String(value ?? '').trim();
    if (!text) {
      return null;
    }
    const parts = this.tryParseDateTimeLocalParts(text);
    if (parts) {
      const d = new Date(parts.y, parts.m - 1, parts.d, parts.hh, parts.mm, parts.ss);
      const ms = d.getTime();
      return Number.isNaN(ms) ? null : ms;
    }
    const ms = new Date(text).getTime();
    return Number.isNaN(ms) ? null : ms;
  }

  private tryParseDateTimeLocalParts(
    text: string,
  ): { y: number; m: number; d: number; hh: number; mm: number; ss: number } | null {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(text);
    if (!m) {
      return null;
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    const hh = Number(m[4]);
    const mm = Number(m[5]);
    const ss = m[6] !== undefined && m[6] !== '' ? Number(m[6]) : 0;
    if (![y, mo, d, hh, mm, ss].every(n => Number.isFinite(n))) {
      return null;
    }
    return { y, m: mo, d, hh, mm, ss };
  }

  private parseMs(iso: string | undefined): number | null {
    const t = String(iso ?? '').trim();
    if (!t) {
      return null;
    }
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? null : d.getTime();
  }

  private toBookingNumericId(rawId: string): number | null {
    const n = Number(String(rawId ?? '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }
}
