import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, ElementRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
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
import { Booking, BookingSuspendedStatus, SuspendedBookingRequest } from '../../../models';
import {
  bookingStatusTone,
  bookingStatusTranslationKey,
} from '../../../models/booking/booking-status.utils';
import { normalizeSetting } from '../../../models/settings/setting.normalizer';
import { Setting } from '../../../models/settings/setting.model';
import { BookingService } from '../../../services/booking/booking.service';
import { SettingService } from '../../../services/settings/setting.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import {
  FinishBillingResult,
  computeFinishBilling,
  parseFinishWallTimeMs,
} from '../booking-finish/booking-finish-billing.util';
import {
  bookingCheckoutMs,
  bookingCheckoutOdometer,
  isReturnOdometerAboveCheckout,
  parseReturnOdometerInput,
  validateReturnAgainstCheckout,
} from '../booking-return-checkout.util';
import {
  distributeSettlementByPaymentType,
  parseSettlementMoneyInput,
  resolveSettlementPaidAmounts,
  roundSettlementMoney,
  settlementMoneyInputDisplay,
  settlementTotalsMatch,
} from '../booking-settlement-payment.util';

@Component({
  selector: 'app-booking-suspend',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    TranslateModule,
    SmoothSelectComponent,
    DatePickerComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './booking-suspend.component.html',
  styleUrl: './booking-suspend.component.scss',
})
export class BookingSuspendComponent implements OnInit {
  /** `BondTypePaymentcountEnum.Receipt` — matches backend suspend receipt flow. */
  private static readonly BOND_TYPE_RECEIPT = 2;
  private static readonly SUSPEND_REASON_MAX = 500;

  private static readonly SUSPEND_WORKFLOW_SECTION_IDS = [
    'suspend-form-section-reason',
    'suspend-form-section-summary',
    'suspend-form-section-usage',
    'suspend-form-section-time',
    'suspend-form-section-extra',
    'suspend-form-section-payment',
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
  loading = signal(false);
  saving = signal(false);

  returnDateTime = signal('');
  /** Return odometer — required at submit; must exceed contract checkout reading. */
  returnOdometerText = signal('');
  repairs = signal(0);
  traffic = signal(0);
  /** Required — sent as `Note` on `SuspendedBookingCommand`. */
  suspendReason = signal('');
  suspendStatus = signal<BookingSuspendedStatus>('Suspended_due_to_sum_money');

  paymentMethod = signal(1);
  bankAccount = signal('');
  cashAccount = signal('');
  paidCash = signal(0);
  paidBank = signal(0);
  /** المبلغ المدفوع عند التصفية — يُعبّأ تلقائياً من «الباقي» ما لم يعدّله المستخدم. */
  settlementPaidAmount = signal(0);
  private settlementUserEdited = signal(false);

  banks = signal<Bank[]>([]);
  cashAccounts = signal<CashAccount[]>([]);

  /**
   * `GetPaymentcountsSumForBookingQuery` → `GET Paymentcount/sum/{IdBooking}/{fleetId}` (`SumPaymentBooking`).
   * When null, UI falls back to booking snapshot `paidtotal`.
   */
  bookingsPaymentSumFromApi = signal<number | null>(null);

  /** Fleet settings: grace minutes, free late hours, late-hours-per-day threshold. */
  settings = signal<Setting | null>(null);

  isMoneySuspend = computed(() => this.suspendStatus() === 'Suspended_due_to_sum_money');

  isAccidentSuspend = computed(() => this.suspendStatus() === 'Suspended_due_to_accident');

  /** المتبقي على العقد قبل سداد التسوية (قد يكون سالباً عند الدفع الزائد). */
  contractBalanceRaw = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const total = this.computedGrandTotal();
    const paid = this.paymentsTotalDisplay();
    return Math.round((total - paid) * 100) / 100;
  });

  /** التعليق المالي مسموح فقط عند وجود مبلغ متبقٍ أكبر من صفر. */
  moneySuspendAllowed = computed(() => this.contractBalanceRaw() > 0.009);

  moneySuspendBlocked = computed(() => this.isMoneySuspend() && !this.moneySuspendAllowed());

  suspendStatusOptions = computed<SmoothSelectOption[]>(() => [
    {
      label: this.translate.instant('Booking status.Suspended_due_to_accident'),
      value: 'Suspended_due_to_accident',
    },
    {
      label: this.translate.instant('Booking status.Suspended_due_to_sum_money'),
      value: 'Suspended_due_to_sum_money',
    },
  ]);

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

  totalKmAllowance = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const perDay = Math.max(0, Number(b.allowTo ?? 0) || 0);
    const days = Math.max(1, this.billingElapsedDays());
    return Math.round(perDay * days * 100) / 100;
  });

  /** Checkout → return billing (days, late display, chargeable hours/minutes). */
  finishBilling = computed((): FinishBillingResult | null => {
    const b = this.booking();
    if (!b) {
      return null;
    }
    const checkoutMs = bookingCheckoutMs(b);
    const returnMs = parseFinishWallTimeMs(this.returnDateTime());
    if (checkoutMs === null || returnMs === null) {
      return null;
    }
    const s = this.settings();
    return computeFinishBilling(checkoutMs, returnMs, {
      freeLateHours: Math.max(0, Math.trunc(Number(s?.number_hour_latefree ?? 0) || 0)),
      lateHoursPerDayCap: Math.max(0, Math.trunc(Number(s?.number_hour_late_forr_finshinday ?? 0) || 0)),
    });
  });

  billingElapsedDaysFromSpanFloor = computed(() => {
    const fb = this.finishBilling();
    if (fb) {
      return fb.spanFloorDays;
    }
    const b = this.booking();
    return Math.max(1, Math.trunc(Number(b?.countOfDay ?? 0) || 1));
  });

  billingElapsedDays = computed(() => {
    const fb = this.finishBilling();
    if (fb) {
      return fb.billableDays;
    }
    return this.billingElapsedDaysFromSpanFloor();
  });

  dayExcessComputed = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const booked = Math.max(0, Math.trunc(Number(b.countOfDay ?? 0) || 0));
    return Math.max(0, this.billingElapsedDays() - booked);
  });

  /** Remainder hours after full rental days (display only). */
  lateDurationDisplay = computed(() => {
    const fb = this.finishBilling();
    if (!fb || fb.remainderDisplayHours <= 0) {
      return '—';
    }
    return String(fb.remainderDisplayHours);
  });

  /** Sent as `numberOfHoursExcess` and used for hourly amount. */
  chargeableLateHoursCeiled = computed(() => this.finishBilling()?.chargeableHours ?? 0);

  hoursBilledAtLateHourlyRate = computed(() => this.chargeableLateHoursCeiled());

  numberOfHoursExcessComputed = computed(() => this.chargeableLateHoursCeiled());

  dayExcessWithLatePenalty = computed(() => this.dayExcessComputed());

  /** Parsed return odometer; `null` if user has not entered a valid integer. */
  returnOdometerParsed = computed((): number | null => {
    return parseReturnOdometerInput(this.returnOdometerText());
  });

  returnAgainstCheckout = computed(() => {
    const b = this.booking();
    if (!b) {
      return null;
    }
    return validateReturnAgainstCheckout(b, this.returnOdometerText(), this.returnDateTime());
  });

  returnOdometerViolationHint = computed((): string | null => {
    const b = this.booking();
    if (!b || this.suspendLocked()) {
      return null;
    }
    const ret = this.returnOdometerParsed();
    if (ret === null) {
      return null;
    }
    if (isReturnOdometerAboveCheckout(ret, bookingCheckoutOdometer(b))) {
      return null;
    }
    return this.translate.instant('Contract finish return odometer below checkout');
  });

  returnTimeViolationHint = computed((): string | null => {
    const v = this.returnAgainstCheckout();
    if (!v || v.timeOk) {
      return null;
    }
    return this.translate.instant('Contract finish return before checkout');
  });

  suspendSubmitBlocked = computed((): boolean => {
    if (this.suspendLocked() || this.saving()) {
      return true;
    }
    if (this.moneySuspendBlocked()) {
      return true;
    }
    if (!this.suspendReasonSectionComplete()) {
      return true;
    }
    if (!this.suspendUsageSectionComplete() || !this.suspendTimeSectionComplete()) {
      return true;
    }
    if (!this.suspendPaymentSectionComplete()) {
      return true;
    }
    return false;
  });

  odometerDrivenKm = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const checkout = Math.trunc(Number(b.checkoutCounter ?? 0) || 0);
    const ret = this.returnOdometerParsed();
    if (ret === null) {
      return 0;
    }
    return Math.max(0, ret - checkout);
  });

  numberKmExcessComputed = computed(() => {
    const driven = this.odometerDrivenKm();
    const allow = this.totalKmAllowance();
    return Math.max(0, Math.trunc(driven - allow));
  });

  extraKmTotal = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const km = this.numberKmExcessComputed();
    const rate = Number(b.priceKmExtra ?? 0) || 0;
    return Math.round(Math.max(0, km) * Math.max(0, rate) * 100) / 100;
  });

  extraHoursTotal = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const hours = this.chargeableLateHoursCeiled();
    const rate = Number(b.priceHoureExtra ?? 0) || 0;
    return Math.round(Math.max(0, hours) * Math.max(0, rate) * 100) / 100;
  });

  /** Rental + extras + fees − discount. Traffic fines and repairs are excluded from VAT base. */
  computedTaxableNet = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const priceInDay = Number(b.priceInDay ?? 0) || 0;
    const rental = this.billingElapsedDays() * priceInDay;
    const disc = Math.max(0, Number(b.discount ?? 0) || 0);
    const other = Math.max(0, Number(b.otherExpenses ?? 0) || 0);
    const trans = Math.max(0, Number(b.transportationFees ?? 0) || 0);
    const sum =
      rental + this.extraHoursTotal() + this.extraKmTotal() + other + trans - disc;
    return Math.round(Math.max(0, sum) * 100) / 100;
  });

  /** Scale VAT on taxable lines only; traffic and repairs are added after tax on the grand total. */
  computedTaxAmount = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const taxableNet = this.computedTaxableNet();
    const oldTotal = Math.max(0, Number(b.totalAmount ?? 0) || 0);
    const oldTax = Math.max(0, Number(b.totaltax ?? 0) || 0);
    const oldTraffic = Math.max(0, Number(b.totalTrafic ?? 0) || 0);
    const oldRepairs = Math.max(0, Number(b.totalMaintance ?? 0) || 0);
    const oldTaxableNet = Math.max(0, oldTotal - oldTax - oldTraffic - oldRepairs);
    if (oldTaxableNet < 1e-4) {
      return Math.round(oldTax * 100) / 100;
    }
    return Math.round(Math.max(0, taxableNet * (oldTax / oldTaxableNet)) * 100) / 100;
  });

  computedGrandTotal = computed(() => {
    return (
      Math.round(
        (this.computedTaxableNet() +
          this.computedTaxAmount() +
          this.traffic() +
          this.repairs()) *
          100,
      ) / 100
    );
  });

  /** Paid total from payment-counts aggregate, else booking `paidtotal`. */
  paymentsTotalDisplay = computed(() => {
    const fromApi = this.bookingsPaymentSumFromApi();
    if (fromApi !== null && fromApi !== undefined && Number.isFinite(fromApi)) {
      return Math.max(0, fromApi);
    }
    const b = this.booking();
    return Math.max(0, Number(b?.paidtotal ?? 0) || 0);
  });

  balanceDisplay = computed(() => Math.max(0, this.contractBalanceRaw()));

  computedRentalTotal = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const priceInDay = Number(b.priceInDay ?? 0) || 0;
    return Math.round(this.billingElapsedDays() * priceInDay * 100) / 100;
  });

  suspendReasonCharsLeft = computed(() =>
    Math.max(0, BookingSuspendComponent.SUSPEND_REASON_MAX - this.suspendReason().length),
  );

  suspendStatusBadge = computed((): { label: string; className: string } | null => {
    if (this.suspendStatus() === 'Suspended_due_to_accident') {
      return {
        label: this.translate.instant('Contract suspend badge accident'),
        className: 'rt-badge--error',
      };
    }
    return {
      label: this.translate.instant('Contract suspend badge money'),
      className: 'rt-badge--warning',
    };
  });

  balanceCoverageBadge = computed((): { label: string; className: string } | null => {
    const balance = this.balanceDisplay();
    if (balance <= 0.009) {
      return {
        label: this.translate.instant('Contract suspend badge fully covered'),
        className: 'rt-badge--success',
      };
    }
    return {
      label: this.translate.instant('Contract suspend badge amount due'),
      className: 'rt-badge--warning',
    };
  });

  expectedReturnDisplay = computed(() => {
    const value = String(this.returnDateTime() ?? '').trim();
    if (!value) {
      return '—';
    }
    return this.formatDateTime(value);
  });

  contractDurationDisplay = computed(() => {
    const b = this.booking();
    if (!b) {
      return '—';
    }
    const booked = Math.max(0, Math.trunc(Number(b.countOfDay ?? 0) || 0));
    const billed = this.billingElapsedDays();
    if (billed > booked) {
      return this.translate.instant('Contract suspend duration billed', { booked, billed });
    }
    return this.translate.instant('Contract suspend rental days', { count: booked || billed });
  });

  finalBalanceAfterPayment = computed(() => {
    return Math.max(
      0,
      Math.round((this.balanceDisplay() - Math.max(0, Number(this.settlementPaidAmount()) || 0)) * 100) /
        100,
    );
  });

  hasSettlementPayment = computed(() => (Number(this.settlementPaidAmount()) || 0) > 0.009);

  suspendReasonSectionComplete = computed(
    () => !!String(this.suspendReason() ?? '').trim(),
  );

  suspendSummarySectionComplete = computed(() => !!this.booking());

  suspendUsageSectionComplete = computed(() => {
    const v = this.returnAgainstCheckout();
    return !!v?.odometerOk;
  });

  suspendTimeSectionComplete = computed(() => {
    const v = this.returnAgainstCheckout();
    return !!v?.timeOk && !!String(this.returnDateTime() ?? '').trim();
  });

  suspendExtraSectionComplete = computed(() => true);

  suspendPaymentSectionComplete = computed((): boolean => {
    const amount = roundSettlementMoney(this.settlementPaidAmount());
    if (amount <= 0) {
      return true;
    }
    const type = Number(this.paymentMethod()) || 1;
    const bankId = String(this.bankAccount() ?? '').trim();
    const cashId = String(this.cashAccount() ?? '').trim();
    const paidCash = Math.max(0, Number(this.paidCash()) || 0);
    const paidBank = Math.max(0, Number(this.paidBank()) || 0);
    if (!settlementTotalsMatch(roundSettlementMoney(paidCash + paidBank), amount)) {
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

  suspendFormCompletionPercent = computed((): number => {
    let done = 0;
    if (this.suspendReasonSectionComplete()) done++;
    if (this.suspendSummarySectionComplete()) done++;
    if (this.suspendUsageSectionComplete()) done++;
    if (this.suspendTimeSectionComplete()) done++;
    if (this.suspendExtraSectionComplete()) done++;
    if (this.suspendPaymentSectionComplete()) done++;
    return Math.round((done / 6) * 100);
  });

  suspendCurrentWorkflowStep = computed((): number => {
    if (!this.suspendReasonSectionComplete()) {
      return 1;
    }
    if (!this.suspendSummarySectionComplete()) {
      return 2;
    }
    if (!this.suspendUsageSectionComplete()) {
      return 3;
    }
    if (!this.suspendTimeSectionComplete()) {
      return 4;
    }
    if (!this.suspendExtraSectionComplete()) {
      return 5;
    }
    if (!this.suspendPaymentSectionComplete()) {
      return 6;
    }
    return 7;
  });

  focusSuspendWorkflowSection(step: 1 | 2 | 3 | 4 | 5 | 6): void {
    const sectionId = BookingSuspendComponent.SUSPEND_WORKFLOW_SECTION_IDS[step - 1];
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

  constructor() {
    effect(() => {
      if (this.suspendLocked()) {
        return;
      }
      this.balanceDisplay();
      this.computedGrandTotal();
      this.paymentsTotalDisplay();
      this.suspendStatus();
      if (this.settlementUserEdited()) {
        return;
      }
      const amount = 0;
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

  canSuspend(item: Booking | null): boolean {
    if (!item) {
      return false;
    }
    if (item.status === 'finsh' || item.status === 'close') {
      return false;
    }
    if (
      item.status === 'Suspended_due_to_accident' ||
      item.status === 'Suspended_due_to_sum_money'
    ) {
      return false;
    }
    return true;
  }

  /** عقد منتهٍ أو مغلق — تعطيل الحقول وزر الإرسال (التنبيه الظاهر في القالب). */
  suspendLocked(): boolean {
    return !this.canSuspend(this.booking());
  }

  pageHeaderMeta(item: Booking): string {
    const statusKey = `Booking status.${String(item.status ?? '').trim()}`;
    const statusLabel = this.translate.instant(statusKey);
    const status =
      statusLabel === statusKey
        ? this.translate.instant('Booking status.Unknown')
        : statusLabel;
    return this.translate.instant('Contract suspend header meta', {
      ref: this.valueOrDash(item.bookingNumber || item.id),
      customer: this.valueOrDash(item.customerName),
      plate: this.valueOrDash(item.vehiclePlateNumber),
      status,
    });
  }

  selectedSuspendStatusLabel(): string {
    const key = `Booking status.${this.suspendStatus()}`;
    const label = this.translate.instant(key);
    return label === key ? this.suspendStatus() : label;
  }

  bookingStatusLabel(item: Booking): string {
    const key = `Booking status.${String(item.status ?? '').trim()}`;
    const label = this.translate.instant(key);
    return label === key ? this.translate.instant('Booking status.Unknown') : label;
  }

  fleetDisplay(item: Booking): string {
    const name = String(item.fleetName ?? '').trim();
    return name || this.valueOrDash(item.fleetId);
  }

  contractNumber(item: Booking): string {
    return String(item.numberBookingINBasame ?? item.bookingNumber ?? item.id ?? '').trim() || '—';
  }

  statusBadgeLabelKey(status: Booking['status']): string {
    return bookingStatusTranslationKey(status);
  }

  statusBadgeTone(status: Booking['status']): 'success' | 'warning' | 'danger' | 'secondary' | 'info' {
    return bookingStatusTone(status);
  }

  vehicleTypeDisplay(item: Booking): string {
    return this.valueOrDash(item.vehicleName ?? item.vehicleCategoryLabel);
  }

  dateOrDash(iso: string | undefined): string {
    if (!iso?.trim()) {
      return '—';
    }
    return this.formatDateTime(iso);
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

  onReturnDateChange(value: unknown): void {
    if (value === undefined || value === null) {
      return;
    }
    this.returnDateTime.set(String(value ?? ''));
  }

  onReturnOdometerInput(value: string): void {
    this.returnOdometerText.set(String(value ?? ''));
  }

  onRepairsChange(value: string): void {
    const n = Number(value);
    this.repairs.set(Number.isFinite(n) ? Math.max(0, n) : 0);
  }

  onTrafficChange(value: string): void {
    const n = Number(value);
    this.traffic.set(Number.isFinite(n) ? Math.max(0, n) : 0);
  }

  onSuspendReasonChange(value: string): void {
    this.suspendReason.set(
      String(value ?? '').slice(0, BookingSuspendComponent.SUSPEND_REASON_MAX),
    );
  }

  onSuspendStatusChange(value: string): void {
    const v = String(value ?? '').trim() as BookingSuspendedStatus;
    if (v !== 'Suspended_due_to_accident' && v !== 'Suspended_due_to_sum_money') {
      return;
    }
    if (v === 'Suspended_due_to_sum_money' && !this.moneySuspendAllowed()) {
      this.toast.error(this.translate.instant('Contract suspend money balance required'));
      return;
    }
    this.suspendStatus.set(v);
    this.settlementUserEdited.set(false);
    this.settlementPaidAmount.set(0);
    this.paidCash.set(0);
    this.paidBank.set(0);
    this.applySettlementDistribution(0, this.paymentMethod());
  }

  onPaymentMethodChange(value: string): void {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1;
    this.paymentMethod.set(next);
    this.applyPaymentTypeRules(next);
    this.applySettlementDistribution(this.settlementPaidAmount(), next);
  }

  useBalanceAsSettlement(): void {
    if (this.suspendLocked()) {
      return;
    }
    const amount = this.balanceDisplay();
    this.settlementUserEdited.set(true);
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

  /** يوزّع مبلغ التصفية على النقد/البنك حسب طريقة الدفع. */
  onSettlementPaidInput(value: string): void {
    if (this.suspendLocked()) {
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
    if (!item || !this.canSuspend(item)) {
      return;
    }
    const reason = this.suspendReason().trim();
    if (!reason) {
      this.toast.error(this.translate.instant('Contract suspend reason required'));
      return;
    }
    if (this.isMoneySuspend() && !this.moneySuspendAllowed()) {
      this.toast.error(this.translate.instant('Contract suspend money balance required'));
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

    const validation = validateReturnAgainstCheckout(
      item,
      this.returnOdometerText(),
      this.returnDateTime(),
    );
    const returnIso = this.dateTimeLocalToApi(this.returnDateTime());
    if (!returnIso) {
      this.toast.error(this.translate.instant('Contract finish return time invalid'));
      return;
    }
    if (!validation.timeOk) {
      this.toast.error(this.translate.instant('Contract suspend return before checkout'));
      return;
    }

    const retOdo = validation.returnOdom;
    if (retOdo === null) {
      this.toast.error(this.translate.instant('Contract finish return odometer required'));
      return;
    }
    if (!validation.odometerOk) {
      this.toast.error(this.translate.instant('Contract finish return odometer below checkout'));
      return;
    }

    const settlementTarget = roundSettlementMoney(this.settlementPaidAmount());

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
      if (paymentType === 5) {
        if (!bankId || !cashId) {
          this.toast.error(this.translate.instant('Contract finish mixed required'));
          return;
        }
        if (paidCash <= 0 && paidBank <= 0) {
          this.toast.error(this.translate.instant('Contract finish mixed amounts required'));
          return;
        }
      }
      if (!settlementTotalsMatch(paidTotal, settlementTotal)) {
        this.toast.error(this.translate.instant('Paid cash and bank must equal paid amount'));
        return;
      }
    }

    const nHr = this.hoursBilledAtLateHourlyRate();
    const nKm = this.numberKmExcessComputed();
    const dEx = this.dayExcessWithLatePenalty();
    const pKm = Number(item.priceKmExtra ?? 0) || 0;
    const pHr = Number(item.priceHoureExtra ?? 0) || 0;
    const priceInDay = Number(item.priceInDay ?? 0) || 0;
    const pricekmAllExcess = Math.round(Math.max(0, nKm) * Math.max(0, pKm) * 100) / 100;
    const priceoAllHoure = this.extraHoursTotal();
    const calendarDayExcess = this.dayExcessComputed();
    const priceAllDayExcess =
      Math.round((Math.max(0, calendarDayExcess) * Math.max(0, priceInDay)) * 100) / 100;

    const billedDays = this.billingElapsedDays();
    const grandTotal = this.computedGrandTotal();

    const suspendPayload: SuspendedBookingRequest = {
      id: idBooking,
      dateReturnVehical: returnIso,
      numberOfHoursExcess: nHr,
      numberKmExcess: nKm,
      dayExcess: dEx,
      note: reason,
      bondType: BookingSuspendComponent.BOND_TYPE_RECEIPT,
      stutus: this.suspendStatus(),
      allowToall: Number(item.allowTo ?? 0) || 0,
      pricekmAllExcess,
      priceoAllHoure,
      priceAllDayExcess,
      idVehicle,
      idCustomer,
      idBranch,
      fleetId,
      checkoutCounter: Math.trunc(Number(item.checkoutCounter ?? 0) || 0),
      checkinCounter: retOdo,
      countOfDay: billedDays,
      total: grandTotal,
      countKMExtra: nKm,
      priceHoureExtra: pHr,
      priceKmExtra: pKm,
      otherExpenses: Number(item.otherExpenses ?? 0) || 0,
      discount: item.discount ?? null,
      totaltax: this.computedTaxAmount(),
      distancetraveledgps: item.distancetraveledgps,
      totalTrafic: this.traffic(),
      totalMaintance: this.repairs(),
      transportationFees: Number(item.transportationFees ?? 0) || 0,
      idCountingCustVehicle: item.idCountingCustVehicle,
      paid: paidTotal,
      idBank: bankId,
      idCash: cashId,
      paidCash,
      paidBank,
      paymentType,
    };

    const confirmMessage = [
      this.translate.instant('Contract suspend confirm body'),
      this.translate.instant('Contract suspend confirm status line', {
        status: this.selectedSuspendStatusLabel(),
      }),
    ].join('\n');

    this.confirmService
      .confirm(
        this.translate.instant('Contract suspend confirm title'),
        confirmMessage,
      )
      .subscribe(confirmed => {
        if (!confirmed) {
          return;
        }
        this.executeSuspend(suspendPayload, item);
      });
  }

  private executeSuspend(suspendPayload: SuspendedBookingRequest, item: Booking): void {
    this.saving.set(true);
    this.bookingService.suspend(suspendPayload).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Contract suspend success'));
        this.router.navigate(['/booking', 'details', item.id]);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse) {
          const msg =
            String((err.error as { message?: string })?.message ?? '').trim() ||
            String((err.error as { title?: string })?.title ?? '').trim() ||
            err.message;
          this.toast.error(msg || this.translate.instant('Contract suspend failed'));
          return;
        }
        this.toast.error(this.translate.instant('Contract suspend failed'));
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
    forkJoin({
      booking: this.bookingService.getById(id, fleetId).pipe(catchError(() => of(null))),
      setting: this.settingService.getCurrent(fleetId).pipe(
        catchError(() => {
          this.toast.warning(this.translate.instant('Contract finish settings load failed'));
          return of(normalizeSetting({ fleetId }));
        }),
      ),
    }).subscribe(({ booking: b, setting: st }) => {
      this.loading.set(false);
      if (!b) {
        this.toast.error(this.translate.instant('Failed to load booking'));
        this.settings.set(null);
        this.vehicleBranchId.set(null);
        return;
      }
      this.booking.set(b);
      this.settings.set(st);
      this.patchFormFromBooking(b);
      this.loadBookingsPaymentSum(b.id, fleetId);
      this.loadVehicleBranch(b, fleetId);
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

  private patchFormFromBooking(b: Booking): void {
    this.returnDateTime.set(this.nowDateTimeLocalValue());
    this.returnOdometerText.set('');
    this.repairs.set(Math.max(0, Number(b.totalMaintance ?? 0) || 0));
    this.traffic.set(Math.max(0, Number(b.totalTrafic ?? 0) || 0));

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
    this.settlementUserEdited.set(false);
    this.settlementPaidAmount.set(0);
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
      this.applySettlementDistribution(this.settlementPaidAmount(), type);
      return;
    }

    if ([2, 3, 4].includes(type)) {
      this.cashAccount.set('');
      if (!this.bankAccount() && firstBankId) {
        this.bankAccount.set(firstBankId);
      }
      this.paidCash.set(0);
      this.applySettlementDistribution(this.settlementPaidAmount(), type);
      return;
    }

    if (!this.bankAccount() && firstBankId) {
      this.bankAccount.set(firstBankId);
    }
    if (!this.cashAccount() && firstCashId) {
      this.cashAccount.set(firstCashId);
    }
    this.applySettlementDistribution(this.settlementPaidAmount(), type);
  }

  private toBookingNumericId(rawId: string): number | null {
    const n = Number(String(rawId ?? '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private bankCashIdOrUndefined(value: string): string | undefined {
    const s = String(value ?? '').trim().replace(/^\{|\}$/g, '');
    return s ? s : undefined;
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

  private parseBookingInstantMs(iso: string | undefined): number | null {
    const t = String(iso ?? '').trim();
    if (!t) {
      return null;
    }
    const ms = new Date(t).getTime();
    return Number.isNaN(ms) ? null : ms;
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

  /** `YYYY-MM-DDTHH:mm` / `…THH:mm:ss` as **local** wall time (same as `datetime-local`). */
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
}
