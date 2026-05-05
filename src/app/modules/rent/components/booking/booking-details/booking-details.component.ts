import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';
import { PaymentCount } from '../../../../finance/models/payment-counts/payment-count.model';
import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import { Booking, BookingStatus } from '../../../models';
import { bookingStatusTone, bookingStatusTranslationKey } from '../../../models/booking/booking-status.utils';
import { BookingService } from '../../../services/booking/booking.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';

@Component({
  selector: 'app-booking-details',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule, PageHeaderComponent, StatusBadgeComponent],
  templateUrl: './booking-details.component.html',
  styleUrl: './booking-details.component.scss',
})
export class BookingDetailsComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private authState = inject(AuthStateService);
  private bookingService = inject(BookingService);
  private paymentCountService = inject(PaymentCountService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  booking = signal<Booking | null>(null);
  loading = signal(false);
  paymentCountSum = signal<number | null>(null);
  paymentRows = signal<PaymentCount[]>([]);

  statusBadgeTone(status: BookingStatus): 'success' | 'warning' | 'danger' | 'secondary' | 'info' {
    return bookingStatusTone(status);
  }

  statusBadgeLabelKey(status: BookingStatus): string {
    return bookingStatusTranslationKey(status);
  }

  contractNumber(item: Booking): string {
    return (
      String(item.numberBookingINBasame ?? item.bookingNumber ?? item.id ?? '')
        .trim() || '-'
    );
  }

  contractSubtitle(item: Booking): string {
    return this.translate.instant('Contract details subtitle', {
      branch: this.valueOrDash(item.branchName),
      fleet: this.fleetDisplay(item),
      ref: this.valueOrDash(item.bookingNumber || item.id),
    });
  }

  /** Prefer fleet name from API; fallback to fleet id when name is missing. */
  fleetDisplay(item: Booking): string {
    const name = String(item.fleetName ?? '').trim();
    if (name) {
      return name;
    }
    return this.valueOrDash(item.fleetId);
  }

  /** Prefer chart-of-accounts name (`CountingCustVehicleName`); fallback to Guid. */
  countingCustVehicleDisplay(item: Booking): string {
    const name = String(item.countingCustVehicleName ?? '').trim();
    if (name) {
      return name;
    }
    return this.valueOrDash(item.idCountingCustVehicle);
  }

  statusDisplayText(item: Booking): string {
    const custom = String(item.statusDisplayName ?? '').trim();
    if (custom) {
      return custom;
    }
    return this.translate.instant(this.statusBadgeLabelKey(item.status));
  }

  vehiclePhotoLabel(angle: string): string {
    const map: Record<string, string> = {
      front: 'Contract vehicle photo front',
      right: 'Contract vehicle photo right',
      left: 'Contract vehicle photo left',
      back: 'Contract vehicle photo back',
      interior: 'Contract vehicle photo interior',
    };
    const key = map[angle];
    return key ? this.translate.instant(key) : angle;
  }

  logoOnlyUrl(item: Booking): string | null {
    const resolved = resolveMediaUrl(item.urlLogo);
    return resolved && resolved.length > 0 ? resolved : null;
  }

  contractPhotoSlotUrl(item: Booking, phase: 'checkout' | 'return', angle: string): string | null {
    const checkoutMap: Partial<Record<string, string | undefined>> = {
      front: item.checkoutPhotoFrontUrl,
      right: item.checkoutPhotoRightUrl,
      left: item.checkoutPhotoLeftUrl,
      back: item.checkoutPhotoBackUrl,
      interior: item.checkoutPhotoInteriorUrl,
    };
    const returnMap: Partial<Record<string, string | undefined>> = {
      front: item.checkinPhotoFrontUrl,
      right: item.checkinPhotoRightUrl,
      left: item.checkinPhotoLeftUrl,
      back: item.checkinPhotoBackUrl,
      interior: item.checkinPhotoInteriorUrl,
    };
    const raw = (phase === 'checkout' ? checkoutMap[angle] : returnMap[angle]) ?? '';
    const resolved = resolveMediaUrl(raw);
    if (resolved && resolved.length > 0) {
      return resolved;
    }
    return this.logoOnlyUrl(item);
  }

  valueOrDash(value: unknown): string {
    const text = String(value ?? '').trim();
    return text || '-';
  }

  numberOrDash(value: unknown): string {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? String(parsed) : '-';
  }

  moneyOrDash(value: unknown): string {
    if (value === null || value === undefined || value === '') {
      return '-';
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      return '-';
    }
    const lang = this.translate.currentLang || this.translate.getDefaultLang() || 'ar';
    return new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(parsed);
  }

  displayedPaidTotal(item: Booking): number | null {
    const fromPaymentCount = this.paymentCountSum();
    if (fromPaymentCount !== null && Number.isFinite(fromPaymentCount)) {
      return fromPaymentCount;
    }
    const fallback = item.paidtotal ?? item.paidAmount;
    const parsed = Number(fallback);
    return Number.isFinite(parsed) ? parsed : null;
  }

  /** Sum of the «Paid Amount» column from the voucher rows below (جدول السندات). */
  vouchersTablePaidSum(): number {
    return this.paymentRows().reduce((acc, row) => acc + (Number(row.paid) || 0), 0);
  }

  contractTotalWithTax(item: Booking): number | null {
    const n = Number(item.totalAmount);
    return Number.isFinite(n) ? n : null;
  }

  contractTaxAmount(item: Booking): number {
    const t = item.totaltax;
    if (t === null || t === undefined) {
      return 0;
    }
    const n = Number(t);
    return Number.isFinite(n) ? n : 0;
  }

  /** Contract total minus tax line (same breakdown as upper settlement grid). */
  contractTotalWithoutTax(item: Booking): number | null {
    const total = this.contractTotalWithTax(item);
    if (total === null) {
      return null;
    }
    return total - this.contractTaxAmount(item);
  }

  /** `Discount` from booking snapshot — amount deducted from contract total. */
  discountAmount(item: Booking): number {
    const d = item.discount;
    if (d === null || d === undefined) {
      return 0;
    }
    const n = Number(d);
    return Number.isFinite(n) ? n : 0;
  }

  /** Contract total (with tax) minus discount — base for remaining balance & collection rate. */
  totalAfterDiscount(item: Booking): number | null {
    const total = this.contractTotalWithTax(item);
    if (total === null) {
      return null;
    }
    return total - this.discountAmount(item);
  }

  /**
   * Paid amount for remaining-balance math: API voucher sum, else booking paid fields,
   * aligned with «Paid total» in the basics section.
   */
  effectivePaidForBalance(item: Booking): number {
    const displayed = this.displayedPaidTotal(item);
    if (displayed !== null && Number.isFinite(displayed)) {
      return displayed;
    }
    const fromTable = this.vouchersTablePaidSum();
    return Number.isFinite(fromTable) ? fromTable : 0;
  }

  /** Remaining = total after discount − effective paid. */
  contractRemaining(item: Booking): number | null {
    const net = this.totalAfterDiscount(item);
    if (net === null) {
      return null;
    }
    return net - this.effectivePaidForBalance(item);
  }

  collectionProgressPercent(item: Booking): number | null {
    const net = this.totalAfterDiscount(item);
    if (net === null) {
      return null;
    }
    const paid = this.effectivePaidForBalance(item);
    if (net <= 0) {
      return paid > 0 ? 100 : null;
    }
    return Math.min(100, Math.max(0, (paid / net) * 100));
  }

  percentOrDash(item: Booking): string {
    const p = this.collectionProgressPercent(item);
    if (p === null) {
      return '-';
    }
    const lang = this.translate.currentLang || this.translate.getDefaultLang() || 'ar';
    return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(p)}%`;
  }

  decisionHintText(item: Booking): string {
    const total = this.contractTotalWithTax(item);
    if (total === null || total <= 0) {
      return this.translate.instant('Booking decision hint no total');
    }
    const remaining = this.contractRemaining(item) ?? 0;
    const eps = 1e-6;
    if (remaining < -eps) {
      return this.translate.instant('Booking decision hint overpaid');
    }
    if (remaining <= eps) {
      return this.translate.instant('Booking decision hint settled');
    }
    if (this.effectivePaidForBalance(item) <= eps) {
      return this.translate.instant('Booking decision hint unpaid');
    }
    return this.translate.instant('Booking decision hint partial');
  }

  /**
   * True when the sum of voucher rows differs from the canonical paid total (rounding / sync issues).
   */
  voucherPaidSumMismatch(item: Booking): boolean {
    const displayed = this.displayedPaidTotal(item);
    if (displayed === null || !Number.isFinite(displayed)) {
      return false;
    }
    return Math.abs(this.vouchersTablePaidSum() - displayed) > 0.02;
  }

  paymentTypeLabel(value: number | null | undefined): string {
    switch (Number(value)) {
      case 1:
        return this.translate.instant('Cash');
      case 2:
        return this.translate.instant('Network/POS');
      case 3:
        return this.translate.instant('Cheque');
      case 4:
        return this.translate.instant('Bank Transfer');
      case 5:
        return this.translate.instant('Bank/Cash');
      default:
        return '-';
    }
  }

  bondTypeLabel(value: number | null | undefined): string {
    switch (Number(value)) {
      case 1:
        return this.translate.instant('Payment Voucher');
      case 2:
        return this.translate.instant('Receipt Voucher');
      default:
        return '-';
    }
  }

  paymentStatusLabel(value: number | null | undefined): string {
    switch (Number(value)) {
      case 1:
        return this.translate.instant('Draft');
      case 2:
        return this.translate.instant('Confirmed');
      case 3:
        return this.translate.instant('Cancelled');
      default:
        return '-';
    }
  }

  private paymentMethodArabicForPrint(value: number | null | undefined): string {
    switch (Number(value)) {
      case 1:
        return 'نقدا';
      case 2:
        return 'شبكة';
      case 3:
        return 'شيك';
      case 4:
        return 'تحويل بنكي';
      case 5:
        return 'نقدا / بنكي';
      default:
        return '-';
    }
  }

  private toArabicDigits(value: string): string {
    const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return String(value ?? '').replace(/[0-9]/g, d => digits[Number(d)] ?? d);
  }

  private toBookingNumericId(rawId: string): number | null {
    const n = Number(String(rawId ?? '').trim());
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  private loadPaymentSummaryForBooking(booking: Booking): void {
    const fleetId = this.authState.fleetId() ?? '';
    const idBooking = this.toBookingNumericId(booking.id);
    if (!idBooking || !fleetId) {
      this.paymentCountSum.set(null);
      this.paymentRows.set([]);
      return;
    }

    forkJoin({
      sum: this.paymentCountService.getSumForBooking(idBooking, fleetId).pipe(catchError(() => of(null))),
      list: this.paymentCountService.getByBookingId(idBooking, fleetId).pipe(catchError(() => of([]))),
    }).subscribe(({ sum, list }) => {
        const normalizedList = list ?? [];
        this.paymentRows.set(normalizedList);
        if (sum !== null && Number.isFinite(sum)) {
          this.paymentCountSum.set(sum);
          return;
        }
        const reduced = normalizedList.reduce((acc, row) => acc + (Number(row.paid) || 0), 0);
        this.paymentCountSum.set(Number.isFinite(reduced) ? reduced : null);
      });
  }

  dateOrDash(value: string | undefined, format: 'date' | 'datetime' = 'datetime'): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }
    return format === 'date' ? date.toLocaleDateString() : date.toLocaleString();
  }

  /**
   * Print / static HTML: fixed Gregorian + 24h so digits and order stay readable in RTL
   * (avoids toLocaleString + ص/م mixing with numbers).
   */
  private formatBookingDateTimeForPrint(value: string | Date | undefined): string {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) {
        return '-';
      }
      const p = (n: number) => String(n).padStart(2, '0');
      return `${value.getFullYear()}/${p(value.getMonth() + 1)}/${p(value.getDate())} ${p(value.getHours())}:${p(value.getMinutes())}`;
    }
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }
    const d = new Date(text);
    if (Number.isNaN(d.getTime())) {
      return text;
    }
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  /** إيراد أيام التأجير = سعر اليوم × عدد الأيام (عرض فقط في الطباعة). */
  private dailyRentalRevenueForPrint(item: Booking): string {
    const perDay = Number(item.priceInDay);
    const days = Number(item.countOfDay);
    if (!Number.isFinite(perDay) || !Number.isFinite(days)) {
      return '-';
    }
    return this.moneyOrDash(perDay * days);
  }

  /** Print / preview rental contract in `invoise.html` (same flow as finance voucher print). */
  openBookingPrint(autoPrint: boolean): void {
    const item = this.booking();
    if (!item) {
      return;
    }
    const fleetId = this.authState.fleetId() ?? '';
    const idBooking = this.toBookingNumericId(item.id);
    const lastPayment$ =
      idBooking && fleetId
        ? this.paymentCountService.getLastForBooking(idBooking, fleetId).pipe(catchError(() => of(null)))
        : of(null);
    lastPayment$.subscribe(lastPayment => {
      const payloadKey = `booking-print-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      const payload = this.buildBookingPrintPayload(item, autoPrint, lastPayment);
      localStorage.setItem(payloadKey, JSON.stringify(payload));
      const page = autoPrint ? 'invoise-print.html' : 'invoise-view.html';
      const url = `${window.location.origin}/assets/pyment/${page}?payloadKey=${encodeURIComponent(payloadKey)}`;
      const win = window.open('', '_blank', 'width=980,height=760');
      if (!win) {
        this.toast.error(this.translate.instant('Unable to open print preview window'));
        localStorage.removeItem(payloadKey);
        return;
      }
      win.location.href = url;
    });
  }

  private buildBookingPrintPayload(
    item: Booking,
    autoPrint: boolean,
    lastPayment: PaymentCount | null = null,
  ): Record<string, unknown> {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const cIn = Number(item.checkinCounter);
    const cOut = Number(item.checkoutCounter);
    const kmDriven =
      Number.isFinite(cIn) && Number.isFinite(cOut) ? String(Math.round(cIn - cOut)) : '-';

    const receiptAmount = this.moneyOrDash(lastPayment?.paid ?? this.displayedPaidTotal(item));
    const receiptDateGreg = this.formatBookingDateTimeForPrint(lastPayment?.createdAt ?? new Date());
    const receiptCustomerName = this.valueOrDash(item.customerName);
    const paymentMethodAr = this.paymentMethodArabicForPrint(lastPayment?.paymentType);
    const receiptAmountArabicDigits = this.toArabicDigits(receiptAmount);
    const receiptAmountText =
      paymentMethodAr && paymentMethodAr !== '-'
        ? `${receiptAmountArabicDigits} ريال (${paymentMethodAr})`
        : `${receiptAmountArabicDigits} ريال`;
    const paymentNo = this.valueOrDash(lastPayment?.paymentNumber);
    const receiptPurpose = `عقد تأجير (${this.contractNumber(item)}) ورقم المركبة (${this.valueOrDash(item.vehiclePlateNumber)})`;

    return {
      template: 'booking',
      dir: isArabic ? 'rtl' : 'ltr',
      autoPrint: autoPrint ? '1' : '0',
      fleetName: this.fleetDisplay(item),
      logoUrl: this.logoAbsoluteUrlForPrint(item),
      taxNumber: this.valueOrDash(item.taxNumber),
      branchName: this.valueOrDash(item.branchName),
      branchAddress: this.resolveBookingBranchAddress(item),
      documentNo: this.contractNumber(item),
      printDateLabel: this.translate.instant('Print Date'),
      printDate: this.formatBookingDateTimeForPrint(new Date()),
      customerNameAr: this.valueOrDash(item.customerName),
      customerNameEn: this.valueOrDash(item.customerNameEn),
      nationality: this.valueOrDash(item.customerNationality),
      identityNumber: this.valueOrDash(item.customerIqama),
      mobile: this.valueOrDash(item.customerMobile),
      address: this.valueOrDash(item.customerAddress),
      vehicleCategory: this.valueOrDash(item.vehicleCategoryLabel ?? item.vehicleName),
      plateNumber: this.valueOrDash(item.vehiclePlateNumber),
      color: this.valueOrDash(item.vehicleColor),
      vehicleYear: this.numberOrDash(item.vehicleYear),
      startDate: this.formatBookingDateTimeForPrint(item.startDate),
      endDate: this.formatBookingDateTimeForPrint(item.endDate),
      returnDate: this.formatBookingDateTimeForPrint(item.returnDate),
      placeUse: this.valueOrDash(item.placeUSE),
      distanceGps: this.valueOrDash(item.distancetraveledgps),
      checkoutCounter: this.numberOrDash(item.checkoutCounter),
      checkinCounter: this.numberOrDash(item.checkinCounter),
      kmDriven,
      countOfDay: this.numberOrDash(item.countOfDay),
      numberOfHoursExcess: this.numberOrDash(item.numberOfHoursExcess),
      numberKmExcess: this.numberOrDash(item.numberKmExcess),
      dayExcess: this.numberOrDash(item.dayExcess),
      priceInDay: this.moneyOrDash(item.priceInDay),
      priceInMonth: this.moneyOrDash(item.priceInMonth),
      allowTo: this.moneyOrDash(item.allowTo),
      priceHoureExtra: this.moneyOrDash(item.priceHoureExtra),
      priceKmExtra: this.moneyOrDash(item.priceKmExtra),
      countKMExtra: this.moneyOrDash(item.countKMExtra),
      otherExpenses: this.moneyOrDash(item.otherExpenses),
      transportationFees: this.moneyOrDash(item.transportationFees),
      totalTrafic: this.moneyOrDash(item.totalTrafic),
      totalMaintance: this.moneyOrDash(item.totalMaintance),
      discount: this.moneyOrDash(item.discount),
      totaltax: this.moneyOrDash(item.totaltax),
      total: this.moneyOrDash(item.totalAmount),
      countingCustVehicle: this.countingCustVehicleDisplay(item),
      dailyRentalRevenue: this.dailyRentalRevenueForPrint(item),
      statusText: this.statusDisplayText(item),
      statusTone: this.statusBadgeTone(item.status),
      totalReceivedVehicle: this.moneyOrDash(item.totalReceivedVehicle),
      paidTotal: this.moneyOrDash(this.displayedPaidTotal(item)),
      totalAfterDiscount: this.moneyOrDash(this.totalAfterDiscount(item)),
      totalWithoutTax: this.moneyOrDash(this.contractTotalWithoutTax(item)),
      remaining: this.moneyOrDash(this.contractRemaining(item)),
      collectionPercent: this.percentOrDash(item),
      decisionHint: this.decisionHintText(item),
      note: this.valueOrDash(item.notes),
      branchAddressEn: this.resolveBookingBranchAddress(item),
      receiptDateHijri: '',
      receiptDateGreg,
      receiptAmount,
      receiptAmountText,
      receiptCustomerName,
      receiptPurpose,
      receiptVoucherNo: paymentNo,
    };
  }

  /** Absolute URL so the static print page loads the fleet logo reliably. */
  private logoAbsoluteUrlForPrint(item: Booking): string {
    return this.logoOnlyUrl(item) ?? `${window.location.origin}/assets/images/logo/logo-icon.png`;
  }

  private resolveBookingBranchAddress(item: Booking): string {
    const city = String(item.branchCity ?? '').trim();
    const neighborhood = String(item.branchNeighborHood ?? '').trim();
    const street = String(item.branchStreet ?? '').trim();
    const building = String(item.branchBuildingNumber ?? '').trim();
    const parts = [city, neighborhood, street].filter(Boolean);
    if (building) {
      parts.push(`No. ${building}`);
    }
    const composed = parts.join(' - ');
    return composed || this.valueOrDash(item.branchName);
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      return;
    }

    this.loading.set(true);
    this.bookingService.getById(id, this.authState.fleetId() ?? '').subscribe({
      next: booking => {
        this.booking.set(booking);
        this.loadPaymentSummaryForBooking(booking);
      },
      error: () => this.toast.error(this.translate.instant('Failed to load booking')),
      complete: () => this.loading.set(false),
    });
  }
}
