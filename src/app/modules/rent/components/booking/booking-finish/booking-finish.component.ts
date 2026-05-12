import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { Bank } from '../../../../finance/models/banks/bank.model';
import { BankService } from '../../../../finance/services/banks/bank.service';
import { CashAccount } from '../../../../finance/models/cash/cash-account.model';
import { CashAccountService } from '../../../../finance/services/cash/cash-account.service';
import { Booking, BookingUpdateRequest } from '../../../models';
import { BookingService } from '../../../services/booking/booking.service';

@Component({
  selector: 'app-booking-finish',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, PageHeaderComponent, SmoothSelectComponent],
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
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  booking = signal<Booking | null>(null);
  loading = signal(false);
  saving = signal(false);

  returnDateTime = signal('');
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
    const days = Math.max(0, Number(b.countOfDay ?? 0) || 0);
    return Math.round(perDay * days * 100) / 100;
  });

  extraKmTotal = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const km = Number(b.numberKmExcess ?? 0) || 0;
    const rate = Number(b.priceKmExtra ?? 0) || 0;
    return Math.round(Math.max(0, km) * Math.max(0, rate) * 100) / 100;
  });

  extraHoursTotal = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const hours = Number(b.numberOfHoursExcess ?? 0) || 0;
    const rate = Number(b.priceHoureExtra ?? 0) || 0;
    return Math.round(hours * rate * 100) / 100;
  });

  balanceDisplay = computed(() => {
    const b = this.booking();
    if (!b) {
      return 0;
    }
    const total = Math.max(0, Number(b.totalAmount ?? 0) || 0);
    const paid = Math.max(0, Number(b.paidtotal ?? 0) || 0);
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

  onReturnDateChange(value: string): void {
    this.returnDateTime.set(String(value ?? ''));
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
    if (!idCustomer) {
      this.toast.error(this.translate.instant('Contract finish missing ids'));
      return;
    }

    const paymentType = Number(this.paymentMethod()) || 1;
    const bankId = this.bankCashIdOrUndefined(this.bankAccount());
    const cashId = this.bankCashIdOrUndefined(this.cashAccount());

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

    const payload: BookingUpdateRequest = {
      id: idBooking,
      idCustomer,
      idVehicle: idVehicle ?? undefined,
      idBranch,
      checkoutCounter: item.checkoutCounter,
      checkinCounter: item.checkinCounter,
      countOfDay: item.countOfDay,
      total: item.totalAmount,
      discount: item.discount,
      priceInDay: item.priceInDay,
      priceInMonth: item.priceInMonth,
      allowTo: item.allowTo,
      countKMExtra: item.countKMExtra,
      priceHoureExtra: item.priceHoureExtra,
      priceKmExtra: item.priceKmExtra,
      otherExpenses: item.otherExpenses,
      totaltax: item.totaltax ?? undefined,
      startDate: item.startDate,
      endDate: item.endDate,
      dateReturnVehical: this.dateTimeLocalToApi(this.returnDateTime()) || item.returnDate || item.endDate,
      note: this.notes().trim() || undefined,
      placeUSE: item.placeUSE,
      numberBookingINBasame: item.numberBookingINBasame,
      distancetraveledgps: item.distancetraveledgps,
      totalTrafic: this.traffic(),
      totalMaintance: this.repairs(),
      totalReceivedVehicle: item.totalReceivedVehicle,
      transportationFees: item.transportationFees,
      idCountingCustVehicle: item.idCountingCustVehicle,
      stutus: 'finsh',
      paymentType,
      bondType: 1,
      idBank: bankId,
      idCash: cashId,
      paidCash,
      paidBank,
    };

    this.saving.set(true);
    this.bookingService.update(payload).subscribe({
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
    this.bookingService
      .getById(id, fleetId)
      .pipe(catchError(() => of(null)))
      .subscribe(b => {
        this.loading.set(false);
        if (!b) {
          this.toast.error(this.translate.instant('Failed to load booking'));
          return;
        }
        this.booking.set(b);
        this.patchFormFromBooking(b);
      });
  }

  private patchFormFromBooking(b: Booking): void {
    this.returnDateTime.set(this.toDateTimeLocalValue(b.returnDate || b.endDate));
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
}
