import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { Bank } from '../../../../finance/models/banks/bank.model';
import { BankService } from '../../../../finance/services/banks/bank.service';
import { CashAccount } from '../../../../finance/models/cash/cash-account.model';
import { CashAccountService } from '../../../../finance/services/cash/cash-account.service';
import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import { Booking, FinshBookingRequest } from '../../../models';
import { normalizeSetting } from '../../../models/settings/setting.normalizer';
import { Setting } from '../../../models/settings/setting.model';
import { BookingService } from '../../../services/booking/booking.service';
import { SettingService } from '../../../services/settings/setting.service';
import {
  FinishBillingResult,
  computeFinishBilling,
  parseFinishWallTimeMs,
} from './booking-finish-billing.util';

@Component({
  selector: 'app-booking-finish',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule, PageHeaderComponent, SmoothSelectComponent, DatePickerComponent],
  templateUrl: './booking-finish.component.html',
  styleUrl: './booking-finish.component.scss',
})
export class BookingFinishComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private bookingService = inject(BookingService);
  private bankService = inject(BankService);
  private cashAccountService = inject(CashAccountService);
  private paymentCountService = inject(PaymentCountService);
  private settingService = inject(SettingService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  booking = signal<Booking | null>(null);
  loading = signal(false);
  saving = signal(false);

  returnDateTime = signal('');
  /** Return odometer — required at submit; must exceed contract checkout reading. */
  returnOdometerText = signal('');
  repairs = signal(0);
  traffic = signal(0);
  notes = signal('');

  paymentMethod = signal(1);
  bankAccount = signal('');
  cashAccount = signal('');
  paidCash = signal(0);
  paidBank = signal(0);

  banks = signal<Bank[]>([]);
  cashAccounts = signal<CashAccount[]>([]);

  /**
   * `GetPaymentcountsSumForBookingQuery` → `GET Paymentcount/sum/{IdBooking}/{fleetId}` (`SumPaymentBooking`).
   * When null, UI falls back to booking snapshot `paidtotal`.
   */
  bookingsPaymentSumFromApi = signal<number | null>(null);

  /** Fleet settings: grace minutes, free late hours, late-hours-per-day threshold. */
  settings = signal<Setting | null>(null);

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

  /**
   * المبلغ المدفوع عند التصفية: نقدي فقط → المبلغ النقدي؛ بنكي فقط → المبلغ البنكي؛ مختلط → مجموع النقد + البنك (للعرض).
   */
  settlementPaidDisplay = computed(() => {
    const cash = Math.max(0, Number(this.paidCash()) || 0);
    const bank = Math.max(0, Number(this.paidBank()) || 0);
    if (this.paymentMethod() === 5) {
      return Math.round((cash + bank) * 100) / 100;
    }
    if (this.paymentMethod() === 1) {
      return Math.round(cash * 100) / 100;
    }
    return Math.round(bank * 100) / 100;
  });

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
    const checkoutMs = parseFinishWallTimeMs(this.toDateTimeLocalValue(b.startDate));
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
    const raw = String(this.returnOdometerText() ?? '').trim();
    if (!raw) {
      return null;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) {
      return null;
    }
    return Math.trunc(n);
  });

  numberKmExcessComputed = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const checkout = Math.trunc(Number(b.checkoutCounter ?? 0) || 0);
    const ret = this.returnOdometerParsed();
    if (ret === null) {
      return 0;
    }
    const driven = Math.max(0, ret - checkout);
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

  computedNetBeforeTax = computed(() => {
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
      rental +
      this.extraHoursTotal() +
      this.extraKmTotal() +
      other +
      this.traffic() +
      this.repairs() +
      trans -
      disc;
    return Math.round(Math.max(0, sum) * 100) / 100;
  });

  /** Scale tax with net so changing return time/odometer updates VAT roughly like the original contract ratio. */
  computedTaxAmount = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const net = this.computedNetBeforeTax();
    const oldTotal = Math.max(0, Number(b.totalAmount ?? 0) || 0);
    const oldTax = Math.max(0, Number(b.totaltax ?? 0) || 0);
    const oldNet = Math.max(0, oldTotal - oldTax);
    if (oldNet < 1e-4) {
      return Math.round(oldTax * 100) / 100;
    }
    return Math.round(Math.max(0, net * (oldTax / oldNet)) * 100) / 100;
  });

  computedGrandTotal = computed(() => {
    return Math.round((this.computedNetBeforeTax() + this.computedTaxAmount()) * 100) / 100;
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

  balanceDisplay = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const total = this.computedGrandTotal();
    const paid = this.paymentsTotalDisplay();
    return Math.max(0, Math.round((total - paid) * 100) / 100);
  });

  ngOnInit(): void {
    const id = String(this.route.snapshot.paramMap.get('id') ?? '').trim();
    if (!id) {
      this.toast.error(this.translate.instant('Failed to load booking'));
      return;
    }
    this.loadLookups();
    this.loadBooking(id);
  }

  canFinish(item: Booking | null): boolean {
    if (!item) {
      return false;
    }
    return item.status !== 'finsh' && item.status !== 'close';
  }

  /** عقد منتهٍ أو مغلق — تعطيل الحقول وزر الإرسال (التنبيه الظاهر في القالب). */
  finishLocked(): boolean {
    return !this.canFinish(this.booking());
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

  onNotesChange(value: string): void {
    this.notes.set(String(value ?? ''));
  }

  onPaymentMethodChange(value: string): void {
    const parsed = Number(value);
    const next = Number.isFinite(parsed) && parsed >= 1 && parsed <= 5 ? parsed : 1;
    this.paymentMethod.set(next);
    this.applyPaymentTypeRules(next);
  }

  onBankChange(value: string): void {
    this.bankAccount.set(String(value ?? '').trim());
  }

  onCashChange(value: string): void {
    this.cashAccount.set(String(value ?? '').trim());
  }

  onPaidCashChange(value: string): void {
    const parsed = Number(value);
    const cash = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    if (this.paymentMethod() === 5) {
      const prevTotal = Math.max(0, Number(this.paidCash()) + Number(this.paidBank()));
      this.paidCash.set(cash);
      const bank = Math.max(0, Math.round((prevTotal - cash) * 100) / 100);
      this.paidBank.set(bank);
      return;
    }
    this.paidCash.set(cash);
  }

  onPaidBankChange(value: string): void {
    const parsed = Number(value);
    const bank = Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
    if (this.paymentMethod() === 5) {
      const prevTotal = Math.max(0, Number(this.paidCash()) + Number(this.paidBank()));
      this.paidBank.set(bank);
      const cash = Math.max(0, Math.round((prevTotal - bank) * 100) / 100);
      this.paidCash.set(cash);
      return;
    }
    this.paidBank.set(bank);
  }

  /** يحدّث المبلغ النقدي أو البنكي حسب طريقة الدفع (لا يُستخدم في الدفع المختلط). */
  onSettlementPaidInput(value: string): void {
    if (this.finishLocked() || this.paymentMethod() === 5) {
      return;
    }
    const raw = String(value ?? '').trim().replace(',', '.');
    const parsed = Number(raw);
    const n = Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100) / 100) : 0;
    if (this.paymentMethod() === 1) {
      this.paidCash.set(n);
      this.paidBank.set(0);
      return;
    }
    if ([2, 3, 4].includes(this.paymentMethod())) {
      this.paidCash.set(0);
      this.paidBank.set(n);
    }
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

  submit(): void {
    const item = this.booking();
    if (!item || !this.canFinish(item)) {
      return;
    }
    const ok = window.confirm(this.translate.instant('Contract finish confirm'));
    if (!ok) {
      return;
    }
    const fleetId = this.authState.fleetId() ?? '';
    const idBooking = this.toBookingNumericId(item.id);
    const idBranch = Number(item.branchId ?? this.authState.branchId() ?? 0);
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

    const returnIso = this.dateTimeLocalToApi(this.returnDateTime());
    if (!returnIso) {
      this.toast.error(this.translate.instant('Contract finish return time invalid'));
      return;
    }
    const startMs = this.parseBookingInstantMs(item.startDate);
    const retMs = this.parseReturnDateTimeMs(this.returnDateTime());
    if (startMs !== null && retMs !== null && retMs < startMs) {
      this.toast.error(this.translate.instant('Contract finish return before checkout'));
      return;
    }

    const retOdo = this.returnOdometerParsed();
    if (retOdo === null) {
      this.toast.error(this.translate.instant('Contract finish return odometer required'));
      return;
    }
    const checkoutOdo = Math.trunc(Number(item.checkoutCounter ?? 0) || 0);
    if (retOdo <= checkoutOdo) {
      this.toast.error(this.translate.instant('Contract finish return odometer below checkout'));
      return;
    }

    if (paymentType === 1 && !cashId) {
      this.toast.error(this.translate.instant('Contract finish cash required'));
      return;
    }
    if ([2, 3, 4].includes(paymentType) && !bankId) {
      this.toast.error(this.translate.instant('Contract finish bank required'));
      return;
    }
    if (paymentType === 5 && (!bankId || !cashId)) {
      this.toast.error(this.translate.instant('Contract finish mixed required'));
      return;
    }

    const paidCash = Math.max(0, Number(this.paidCash()) || 0);
    const paidBank = Math.max(0, Number(this.paidBank()) || 0);
    const paidTotal = Math.round((paidCash + paidBank) * 100) / 100;

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

    const finishPayload: FinshBookingRequest = {
      id: idBooking,
      dateReturnVehical: returnIso,
      numberOfHoursExcess: nHr,
      numberKmExcess: nKm,
      dayExcess: dEx,
      note: this.notes().trim() || undefined,
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

    this.saving.set(true);
    this.bookingService.finish(finishPayload).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Contract finish success'));
        this.router.navigate(['/booking', item.id, 'details']);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (err instanceof HttpErrorResponse) {
          const msg =
            String((err.error as { message?: string })?.message ?? '').trim() ||
            String((err.error as { title?: string })?.title ?? '').trim() ||
            err.message;
          this.toast.error(msg || this.translate.instant('Contract finish failed'));
          return;
        }
        this.toast.error(this.translate.instant('Contract finish failed'));
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
        return;
      }
      this.booking.set(b);
      this.settings.set(st);
      this.patchFormFromBooking(b);
      this.loadBookingsPaymentSum(b.id, fleetId);
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
    this.notes.set(String(b.notes ?? ''));

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
    this.applyPaymentTypeRules(this.paymentMethod());
  }

  private loadLookups(): void {
    const fleetId = this.authState.fleetId() || undefined;
    forkJoin({
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cashAccounts: this.cashAccountService.getList(fleetId).pipe(catchError(() => of([]))),
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
