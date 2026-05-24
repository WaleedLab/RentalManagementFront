import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { resolveContractPaymentBranch } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { Booking, BookingUpdateRequest, Setting } from '../../../models';
import { BookingService } from '../../../services/booking/booking.service';
import { SettingService } from '../../../services/settings/setting.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import {
  CloseRulesInput,
  CloseRulesSettings,
  drivenKmForClose,
  kmCloseViolated,
  minutesLateForClose,
  resolveCheckoutMs,
  resolvePlannedReturnEndMs,
  timeCloseViolated,
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
  imports: [CommonModule, RouterLink, TranslateModule, PageHeaderComponent, DatePickerComponent],
  templateUrl: './booking-close.component.html',
  styleUrl: './booking-close.component.scss',
})
export class BookingCloseComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private bookingService = inject(BookingService);
  private vehicleService = inject(VehicleService);
  private settingService = inject(SettingService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

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
      bookedDays: Math.max(0, Math.trunc(Number(item.countOfDay) || 0)),
      endDateIso: item.endDate,
    };
  }

  closeDisabledReason = computed((): 'locked' | 'invalid_odom' | 'invalid_return_time' | null => {
    const item = this.booking();
    if (!item || !this.canClose(item)) {
      return 'locked';
    }
    if (!this.odometerKmTestPassed()) {
      return 'invalid_odom';
    }
    if (!this.returnTimeAfterCheckoutPassed()) {
      return 'invalid_return_time';
    }
    return null;
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
    const rules = this.buildCloseRulesInput(item, Date.now(), ret);
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
    const rules = this.buildCloseRulesInput(item, Date.now(), ret);
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
    if (v.timeOk || v.checkoutMs === null) {
      return null;
    }
    return this.translate.instant('Contract finish return before checkout');
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

  submit(): void {
    const item = this.booking();
    const s = this.settings();
    if (!item || !this.canClose(item)) {
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

    const ok = window.confirm(this.translate.instant('Contract close confirm'));
    if (!ok) {
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
    if (!idCustomer) {
      this.toast.error(this.translate.instant('Contract finish missing ids'));
      return;
    }

    const payload: BookingUpdateRequest = {
      id: idBooking,
      idCustomer,
      idVehicle: idVehicle ?? undefined,
      idBranch,
      checkoutCounter: item.checkoutCounter,
      checkinCounter: validation.returnOdom,
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
      dateReturnVehical: returnIso,
      note: this.notes().trim() || undefined,
      placeUSE: item.placeUSE,
      numberBookingINBasame: item.numberBookingINBasame,
      distancetraveledgps: item.distancetraveledgps,
      totalTrafic: item.totalTrafic,
      totalMaintance: item.totalMaintance,
      totalReceivedVehicle: item.totalReceivedVehicle,
      transportationFees: item.transportationFees,
      idCountingCustVehicle: item.idCountingCustVehicle,
      stutus: 'close',
    };

    this.saving.set(true);
    this.bookingService.update(payload).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Contract close success'));
        this.router.navigate(['/booking', item.id, 'details']);
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
      return;
    }
    this.vehicleService.getById(vehicleId, fleetId).subscribe({
      next: vehicle => {
        const branch = Number(vehicle?.branchId ?? 0);
        this.vehicleBranchId.set(Number.isFinite(branch) && branch > 0 ? branch : null);
      },
      error: () => this.vehicleBranchId.set(null),
    });
  }

  private buildCloseWarningMessages(
    item: Booking,
    s: Setting | null,
    rules: CloseRulesInput,
  ): string[] {
    const parts: string[] = [];
    if (!s) {
      return parts;
    }
    const settings = this.closeRulesSettings(s);
    if (kmCloseViolated(rules, settings)) {
      parts.push(
        this.translate.instant('Contract close warning km detail', {
          drivenKm: drivenKmForClose(rules.checkoutOdom, rules.returnOdom),
          allowedKm: settings.allowedDrivenKm,
        }),
      );
    }
    if (timeCloseViolated(rules, settings)) {
      const plannedEndMs = resolvePlannedReturnEndMs(
        rules.checkoutMs,
        rules.bookedDays,
        rules.endDateIso,
      );
      parts.push(
        this.translate.instant('Contract close warning time detail', {
          checkoutTime: this.formatDateTime(item.startDate ?? item.pickupDate),
          plannedEnd: this.formatDateTime(new Date(plannedEndMs).toISOString()),
          returnTime: this.formatDateTime(this.dateTimeLocalToApi(this.returnDateTime())),
          lateMinutes: Math.ceil(minutesLateForClose(rules)),
          allowedMinutes: settings.allowedLateMinutes,
        }),
      );
    }
    return parts;
  }

  private initialReturnDateTimeLocal(b: Booking): string {
    const fromReturn = this.toDateTimeLocalValue(b.returnDate);
    if (fromReturn) {
      return fromReturn;
    }
    const fromEnd = this.toDateTimeLocalValue(b.endDate);
    if (fromEnd) {
      return fromEnd;
    }
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
