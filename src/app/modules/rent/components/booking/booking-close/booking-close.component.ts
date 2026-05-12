import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { Booking, BookingUpdateRequest, Setting } from '../../../models';
import { BookingService } from '../../../services/booking/booking.service';
import { SettingService } from '../../../services/settings/setting.service';

@Component({
  selector: 'app-booking-close',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './booking-close.component.html',
  styleUrl: './booking-close.component.scss',
})
export class BookingCloseComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private bookingService = inject(BookingService);
  private settingService = inject(SettingService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  booking = signal<Booking | null>(null);
  settings = signal<Setting | null>(null);
  loading = signal(false);
  saving = signal(false);

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
    const raw = String(this.returnOdometerText()).trim();
    if (!raw) {
      return null;
    }
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }

  /** Minutes after scheduled contract end (`endDate`); 0 if still before/at end. */
  minutesPastContractEnd(item: Booking): number {
    const endMs = this.parseMs(item.endDate);
    if (endMs === null) {
      return 0;
    }
    const delta = Date.now() - endMs;
    if (delta <= 0) {
      return 0;
    }
    return delta / 60000;
  }

  timeCloseViolated(item: Booking, s: Setting | null): boolean {
    if (!s) {
      return false;
    }
    const allowed = Math.max(0, Number(s.number_mints_late_forr_finshcontract) || 0);
    if (allowed <= 0) {
      return false;
    }
    return this.minutesPastContractEnd(item) > allowed;
  }

  kmCloseViolated(item: Booking, s: Setting | null, returnOdom: number): boolean {
    if (!s) {
      return false;
    }
    const limit = Math.max(0, Number(s.number_incres_km_for_finshcontract) || 0);
    if (limit <= 0) {
      return false;
    }
    const exit = Math.max(0, Number(item.checkoutCounter) || 0);
    const totalAllow =
      Math.max(0, Number(item.allowTo) || 0) * Math.max(0, Number(item.countOfDay) || 0);
    const driven = returnOdom - exit;
    const excess = Math.max(0, driven - totalAllow);
    return excess > limit;
  }

  closeDisabledReason = computed((): 'locked' | 'invalid_odom' | null => {
    const item = this.booking();
    if (!item || !this.canClose(item)) {
      return 'locked';
    }
    const ret = this.parsedReturnOdometer();
    if (ret === null) {
      return 'invalid_odom';
    }
    const exit = Math.max(0, Number(item.checkoutCounter) || 0);
    if (ret < exit) {
      return 'invalid_odom';
    }
    return null;
  });

  dismissWarning(): void {
    this.warningMessage.set(null);
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
    const ret = this.parsedReturnOdometer();
    const exit = Math.max(0, Number(item.checkoutCounter) || 0);
    if (ret === null) {
      this.toast.error(this.translate.instant('Contract close odometer required'));
      return;
    }
    if (ret < exit) {
      this.toast.error(this.translate.instant('Contract close odometer below checkout'));
      return;
    }

    const parts: string[] = [];
    if (s && this.timeCloseViolated(item, s)) {
      parts.push(
        this.translate.instant('Contract close warning time', {
          minutes: this.allowedCloseMinutes(),
        }),
      );
    }
    if (s && this.kmCloseViolated(item, s, ret)) {
      parts.push(
        this.translate.instant('Contract close warning km', {
          km: this.allowedCloseKmMargin(),
        }),
      );
    }
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

    const returnIso = new Date().toISOString();
    const payload: BookingUpdateRequest = {
      id: idBooking,
      idCustomer,
      idVehicle: idVehicle ?? undefined,
      idBranch,
      checkoutCounter: item.checkoutCounter,
      checkinCounter: ret,
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
        return;
      }
      this.booking.set(b);
      this.settings.set(st);
      const existing = Number(b.checkinCounter);
      if (Number.isFinite(existing) && existing > 0) {
        this.returnOdometerText.set(String(Math.trunc(existing)));
      } else {
        this.returnOdometerText.set('');
      }
      this.notes.set(String(b.notes ?? ''));
    });
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
