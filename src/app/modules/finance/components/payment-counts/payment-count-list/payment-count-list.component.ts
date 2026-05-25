import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TranslateService, TranslateModule } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, map, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { loginBranchId } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import {
  SmoothSelectOption,
  SmoothSelectComponent,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { BookingService } from '../../../../rent/services/booking/booking.service';
import { BranchService } from '../../../../rent/services/branches/branch.service';
import { CustomerService } from '../../../../rent/services/customers/customer.service';
import { VehicleService } from '../../../../rent/services/vehicles/vehicle.service';
import { PaymentCount } from '../../../models/payment-counts/payment-count.model';
import {
  FinanceListAction,
  FinanceListColumn,
  FinanceListRow,
} from '../../../models/shared/finance-list.model';
import { BankService } from '../../../services/banks/bank.service';
import { CashAccountService } from '../../../services/cash/cash-account.service';
import { PaymentCountService } from '../../../services/payment-counts/payment-count.service';
import { formatFinanceNumber } from '../../shared/finance-list-formatters';
import { FINANCE_MENU_ICONS } from '../../../common/finance.constants';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';

@Component({
  selector: 'app-payment-count-list',
  standalone: true,
  imports: [FinanceListShellComponent, SmoothSelectComponent, TranslateModule],
  templateUrl: './payment-count-list.component.html',
  styleUrl: './payment-count-list.component.scss',
})
export class PaymentCountListComponent implements OnInit {
  readonly financeIcons = FINANCE_MENU_ICONS;

  private authState = inject(AuthStateService);
  private paymentCountService = inject(PaymentCountService);
  private customerService = inject(CustomerService);
  private vehicleService = inject(VehicleService);
  private branchService = inject(BranchService);
  private bookingService = inject(BookingService);
  private bankService = inject(BankService);
  private cashAccountService = inject(CashAccountService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  items = signal<PaymentCount[]>([]);
  customerNames = signal<Record<string, string>>({});
  vehicleNames = signal<Record<string, string>>({});
  vehicleDetails = signal<
    Record<string, { name: string; plateNumber: string; yearMake: string; category: string }>
  >({});
  branchNames = signal<Record<string, string>>({});
  bookingNames = signal<Record<string, string>>({});
  bankNames = signal<Record<string, string>>({});
  cashNames = signal<Record<string, string>>({});
  loading = signal(false);
  loadError = signal<string | null>(null);
  pageNumber = signal(1);
  pageSize = signal(10);
  totalPages = signal(1);
  totalCount = signal(0);
  search = signal('');
  bondTypeFilter = signal<number | ''>('');
  paymentTypeFilter = signal<number | ''>('');
  branchFilter = signal<number | ''>('');
  orderBy = signal<'CreatedAt' | 'Paid' | 'UpdatedAt'>('CreatedAt');
  orderByDirection = signal<'ASC' | 'DESC'>('DESC');
  private searchInput$ = new Subject<string>();
  private languageTick = signal(0);

  readonly columns: FinanceListColumn[] = [
    { key: 'paymentNumber', label: 'Payment Number', align: 'end' },
    { key: 'amount', label: 'Paid', align: 'end' },
    { key: 'status', label: 'Status' },
    { key: 'bondType', label: 'Bond Type' },
    { key: 'paymentType', label: 'Payment Type' },
    { key: 'customer', label: 'Customer' },
    { key: 'vehicle', label: 'Vehicle' },
    { key: 'branch', label: 'Branch' },
    { key: 'cash', label: 'Cash' },
    { key: 'bank', label: 'Bank' },
    { key: 'paidCash', label: 'Paid Cash', align: 'end' },
    { key: 'paidBank', label: 'Paid Bank', align: 'end' },
    { key: 'booking', label: 'Booking' },
  ];
  readonly rowActions: FinanceListAction[] = [
    { key: 'view', label: 'View', icon: 'fa-solid fa-eye', variant: 'info', iconOnly: true },
    {
      key: 'print',
      label: 'Print',
      icon: 'fa-solid fa-print',
      variant: 'secondary',
      iconOnly: true,
    },
  ];
  readonly orderByOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('Created At'), value: 'CreatedAt' },
      { label: t('Paid'), value: 'Paid' },
      { label: t('Updated At'), value: 'UpdatedAt' },
    ];
  });
  readonly bondTypeFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    return [
      { label: this.translate.instant('All bond types'), value: '' },
      { label: this.translate.instant('Payment Voucher'), value: 1 },
      { label: this.translate.instant('Receipt Voucher'), value: 2 },
    ];
  });
  readonly paymentTypeFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('All payment types'), value: '' },
      { label: t('Cash'), value: 1 },
      { label: t('Network/POS'), value: 2 },
      { label: t('Cheque'), value: 3 },
      { label: t('Bank Transfer'), value: 4 },
      { label: t('Bank/Cash'), value: 5 },
    ];
  });
  readonly branchFilterOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const options: SmoothSelectOption[] = [{ label: this.translate.instant('All branches'), value: '' }];
    for (const [id, label] of Object.entries(this.branchNames())) {
      options.push({
        label: label || '-',
        value: Number(id),
      });
    }
    return options;
  });

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    return this.items().map(item => ({
      paymentNumber: formatFinanceNumber(item.paymentNumber, this.translate),
      amount: formatFinanceNumber(item.paid, this.translate),
      status:
        item.status === 1
          ? this.translate.instant('Confirmed')
          : item.status === 2
            ? this.translate.instant('Pending')
            : formatFinanceNumber(item.status, this.translate),
      bondType:
        item.bondType === 1
          ? this.translate.instant('Payment Voucher')
          : item.bondType === 2
            ? this.translate.instant('Receipt Voucher')
            : this.translate.instant('Unknown'),
      paymentType:
        item.paymentType === 1
          ? this.translate.instant('Cash')
          : item.paymentType === 2
            ? this.translate.instant('Network/POS')
            : item.paymentType === 3
              ? this.translate.instant('Cheque')
              : item.paymentType === 4
                ? this.translate.instant('Bank Transfer')
                : item.paymentType === 5
                  ? this.translate.instant('Bank/Cash')
                  : this.translate.instant('Unknown'),
      customer: this.resolveCustomerName(item),
      vehicle: this.resolveVehicleName(item),
      branch: this.resolveBranchName(item),
      cash: this.resolveCashName(item),
      bank: this.resolveBankName(item),
      paidCash: formatFinanceNumber(item.paidCash, this.translate),
      paidBank: formatFinanceNumber(item.paidBank, this.translate),
      booking: this.resolveBookingName(item),
    }));
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(value => value + 1);
    });
    this.searchInput$
      .pipe(debounceTime(350), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
      .subscribe(search => {
        this.search.set(search.trim());
        this.pageNumber.set(1);
        this.load();
      });
    this.loadLookups();
    this.load();
  }

  private loadLookups(): void {
    const fleetId = this.authState.fleetId() ?? undefined;

    forkJoin({
      customers: this.customerService
        .getPaginated({ fleetId, pageNumber: 1, pageSize: 300, search: '', isActive: true })
        .pipe(catchError(() => of({ items: [] }))),
      vehicles: this.vehicleService
        .getPaginated({ fleetId, pageNumber: 1, pageSize: 300, search: '', status: '' })
        .pipe(catchError(() => of({ items: [] }))),
      branches: this.branchService
        .getList(fleetId)
        .pipe(map(items => ({ items })))
        .pipe(catchError(() => of({ items: [] }))),
      bookings: this.bookingService
        .getList({ fleetId })
        .pipe(map(items => ({ items })))
        .pipe(catchError(() => of({ items: [] }))),
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cash: this.cashAccountService.getList(fleetId, loginBranchId(this.authState.branchId())).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ customers, vehicles, branches, bookings, banks, cash }) => {
        const isArabic = this.translate.currentLang?.startsWith('ar');

        const customerDict: Record<string, string> = {};
        for (const customer of customers.items ?? []) {
          const key = String(customer.id ?? '').trim();
          if (!key) continue;
          const name =
            (isArabic ? customer.nameAr : customer.nameEn) ||
            customer.fullName ||
            customer.nameAr ||
            customer.nameEn ||
            '';
          customerDict[key] = name.trim() || '-';
        }
        this.customerNames.set(customerDict);

        const vehicleDict: Record<string, string> = {};
        const vehicleDetailDict: Record<
          string,
          { name: string; plateNumber: string; yearMake: string; category: string }
        > = {};
        for (const vehicle of vehicles.items ?? []) {
          const key = String(vehicle.id ?? '').trim();
          if (!key) continue;
          const title = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
          const plate = vehicle.plateNumber?.trim() || '';
          vehicleDict[key] = [title, plate].filter(Boolean).join(' - ') || '-';
          vehicleDetailDict[key] = {
            name: title || '-',
            plateNumber: plate || '-',
            yearMake: String(vehicle.yearMake ?? vehicle.year ?? '-'),
            category: String(vehicle.categoryName ?? '-').trim() || '-',
          };
        }
        this.vehicleNames.set(vehicleDict);
        this.vehicleDetails.set(vehicleDetailDict);

        const branchDict: Record<string, string> = {};
        for (const branch of branches.items ?? []) {
          const key = String(branch.id ?? '').trim();
          if (!key) continue;
          const name =
            (isArabic ? branch.nameAr : branch.nameEn) || branch.nameAr || branch.nameEn || '';
          branchDict[key] = name.trim() || '-';
        }
        this.branchNames.set(branchDict);

        const bookingDict: Record<string, string> = {};
        for (const booking of bookings.items ?? []) {
          const key = String(booking.id ?? '').trim();
          if (!key) continue;
          const number = String(booking.bookingNumber || booking.id || '').trim();
          const customer = String(booking.customerName || '').trim();
          bookingDict[key] = [number, customer].filter(Boolean).join(' - ') || '-';
        }
        this.bookingNames.set(bookingDict);

        const bankDict: Record<string, string> = {};
        for (const bank of banks) {
          const key = String(bank.id ?? '').trim();
          if (!key) continue;
          bankDict[key] = bank.name?.trim() || '-';
        }
        this.bankNames.set(bankDict);

        const cashDict: Record<string, string> = {};
        for (const account of cash) {
          const key = String(account.id ?? '').trim();
          if (!key) continue;
          cashDict[key] = account.name?.trim() || '-';
        }
        this.cashNames.set(cashDict);
      },
    });
  }

  private load(): void {
    const fleetId = this.authState.fleetId();
    const requestedPageNumber = this.pageNumber();
    const requestedPageSize = this.pageSize();

    this.loading.set(true);
    this.loadError.set(null);

    this.paymentCountService
      .getPaginated({
        fleetId,
        branchId: Number(this.branchFilter() || 0) || undefined,
        bondTypePaymentcount: Number(this.bondTypeFilter() || 0) || undefined,
        paymentTypePaymentcount: Number(this.paymentTypeFilter() || 0) || undefined,
        pageNumber: requestedPageNumber,
        pageSize: requestedPageSize,
        search: this.search(),
        orderBy: this.orderBy(),
        orderByDirection: this.orderByDirection(),
      })
      .subscribe({
        next: response => {
          this.items.set(response.items ?? []);
          this.pageNumber.set(response.pageNumber || 1);
          this.totalPages.set(response.totalPages || 1);
          this.totalCount.set(response.totalCount || 0);
        },
        error: err => {
          const message = err?.message ?? this.translate.instant('No records found');
          this.loadError.set(message);
          this.toast.error(message);
          this.loading.set(false);
        },
        complete: () => this.loading.set(false),
      });
  }

  onSearchChange(value: string): void {
    this.searchInput$.next(value ?? '');
  }

  onBondTypeFilterChange(value: number | ''): void {
    this.bondTypeFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onPaymentTypeFilterChange(value: number | ''): void {
    this.paymentTypeFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onBranchFilterChange(value: number | ''): void {
    this.branchFilter.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onOrderByChange(value: string): void {
    const normalized = (value?.trim() || 'CreatedAt') as 'CreatedAt' | 'Paid' | 'UpdatedAt';
    if (this.orderBy() === normalized) {
      return;
    }
    this.orderBy.set(normalized);
    this.pageNumber.set(1);
    this.load();
  }

  onOrderByDirectionChange(value: 'ASC' | 'DESC'): void {
    if (this.orderByDirection() === value) {
      return;
    }
    this.orderByDirection.set(value);
    this.pageNumber.set(1);
    this.load();
  }

  onPageChange(page: number): void {
    const target = Math.max(1, Number(page) || 1);
    if (target === this.pageNumber()) {
      return;
    }
    this.pageNumber.set(target);
    this.load();
  }

  onPageSizeChange(size: number): void {
    const normalized = Math.max(1, Number(size) || 10);
    if (normalized === this.pageSize()) {
      return;
    }
    this.pageSize.set(normalized);
    this.pageNumber.set(1);
    this.load();
  }

  onRowAction(event: { actionKey: string; rowIndex: number }): void {
    if (event.actionKey !== 'view' && event.actionKey !== 'print') {
      return;
    }
    const rowItem = this.items()[event.rowIndex];
    if (!rowItem) {
      return;
    }
    const paymentCountId = String(rowItem.id ?? '').trim();
    const previewWindow = window.open('', '_blank', 'width=980,height=760');
    if (!previewWindow) {
      this.toast.error(this.translate.instant('Unable to open print preview window'));
      return;
    }

    const fleetId = this.authState.fleetId();
    if (!fleetId || !paymentCountId) {
      previewWindow.close();
      this.toast.error(this.translate.instant('Unable to load voucher data from backend'));
      return;
    }

    this.paymentCountService
      .getById(paymentCountId, fleetId)
      .pipe(
        catchError(() => {
          previewWindow.close();
          this.toast.error(this.translate.instant('Unable to load voucher data from backend'));
          return of(null);
        }),
      )
      .subscribe(item => {
        if (!item) {
          return;
        }
        this.openVoucherPreview(item, event.actionKey === 'print', previewWindow);
      });
  }

  private openVoucherPreview(
    item: PaymentCount,
    autoPrint: boolean,
    previewWindow?: Window | null,
  ): void {
    const voucherNumber = item.paymentNumber != null ? String(item.paymentNumber) : '-';
    const title = `${this.translate.instant('Document No.')}: ${voucherNumber}`;
    const body = this.buildVoucherPrintContent(item);
    this.openPrintWindow(
      title,
      body,
      autoPrint,
      voucherNumber,
      this.resolveBranchName(item),
      item,
      previewWindow,
    );
  }

  private openPrintWindow(
    title: string,
    content: string,
    autoPrint: boolean,
    documentNumber: string,
    branchName: string,
    item?: PaymentCount,
    previewWindow?: Window | null,
  ): void {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const apiItem = item ?? ({} as PaymentCount);
    const vehicle = this.resolveVehiclePrintDetailsFromBackend(apiItem);
    const payloadKey = `finance-print-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = {
      template: 'voucher',
      dir: isArabic ? 'rtl' : 'ltr',
      companyName: this.translate.instant('Car Rental Management'),
      companyNameAr: 'شركة الطريق المتين المحدودة',
      companySubNameAr: 'لتأجير السيارات',
      companyBrandArLine1: 'الطريق المتين',
      companyBrandArLine2: 'لتأجير السيارات',
      companyNameEn: 'Solidroad Co. Ltd',
      companySubNameEn: 'Rent A Car',
      documentKind: this.translate.instant('Official Voucher'),
      title,
      printDateLabel: this.translate.instant('Print Date'),
      printDate: new Date().toLocaleString(),
      branchLabel: this.translate.instant('Branch'),
      branchName: this.readBackendText(apiItem, ['branchName', 'BranchName']),
      docNoLabel: this.translate.instant('Document No.'),
      documentNo: documentNumber || '',
      content,
      autoPrint: autoPrint ? '1' : '0',
      taxRecord: this.readBackendText(apiItem, ['taxNumber', 'TaxNumber', 'taxRecord', 'TaxRecord']),
      logoUrl: this.readBackendText(apiItem, ['urllogo', 'Urllogo', 'urlLogo', 'UrlLogo']),
      paid: apiItem.paid ?? '',
      bondType: apiItem.bondType ?? '',
      date: this.readBackendText(apiItem, ['date', 'Date', 'createdAt', 'CreatedAt']),
      customer: this.readBackendText(apiItem, ['customerName', 'CustomerName']),
      paidString: this.numberToArabicWords(apiItem.paid),
      paymentType: apiItem.paymentType ?? '',
      operationNumber: this.readBackendText(apiItem, ['operationNumber', 'OperationNumber']),
      bankName: this.readBackendText(apiItem, ['bankName', 'BankName']),
      paidBank: apiItem.paidBank ?? '',
      paidCash: apiItem.paidCash ?? '',
      cashName: this.readBackendText(apiItem, ['cashName', 'CashName']),
      vehicleName: vehicle.name,
      vehicleCategory: vehicle.category,
      plateNumber: vehicle.plateNumber,
      bookingNumber: this.readBackendText(apiItem, [
        'bookingNumber',
        'BookingNumber',
        'idBooking',
        'IdBooking',
      ]),
      description: this.readBackendText(apiItem, [
        'dscription',
        'Dscription',
        'description',
        'Description',
      ]),
      voucherDetails: this.resolveVoucherDetailsFromBackend(apiItem),
      status: apiItem.status ?? '',
      branchStreet: this.readBackendText(apiItem, ['branchStreet', 'BranchStreet']),
      branchNeighborHood: this.readBackendText(apiItem, ['branchNeighborHood', 'BranchNeighborHood']),
      branchBuldingNumber: this.readBackendText(apiItem, ['branchBuldingNumber', 'BranchBuldingNumber']),
      branchCity: this.readBackendText(apiItem, ['branchCity', 'BranchCity']),
      branchAddress: this.resolveBranchAddressFromBackend(apiItem),
    };
    localStorage.setItem(payloadKey, JSON.stringify(payload));
    const page = autoPrint ? 'invoise-print.html' : 'invoise-view.html';
    const url = `${window.location.origin}/assets/pyment/${page}?payloadKey=${encodeURIComponent(payloadKey)}`;
    const win = previewWindow ?? window.open('', '_blank', 'width=980,height=760');
    if (!win) {
      this.toast.error(this.translate.instant('Unable to open print preview window'));
      localStorage.removeItem(payloadKey);
      return;
    }
    win.location.href = url;
  }

  private numberToArabicWords(value?: number): string {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return '';
    }
    return `${formatFinanceNumber(value, this.translate)} ريال`;
  }

  private buildVoucherPrintContent(item: PaymentCount): string {
    const statusLabel =
      item.status === 1 ? this.translate.instant('Confirmed') : this.translate.instant('Pending');
    const bondTypeLabel =
      item.bondType === 1
        ? this.translate.instant('Payment Voucher')
        : item.bondType === 2
          ? this.translate.instant('Receipt Voucher')
          : '-';

    return `
      <table>
        <tr>
          <th>${this.translate.instant('Payment Number')}</th>
          <td>${item.paymentNumber ?? '-'}</td>
          <th>${this.translate.instant('Status')}</th>
          <td>${statusLabel}</td>
        </tr>
        <tr>
          <th>${this.translate.instant('Bond Type')}</th>
          <td>${bondTypeLabel}</td>
          <th>${this.translate.instant('Branch')}</th>
          <td>${this.resolveBranchName(item)}</td>
        </tr>
        <tr>
          <th>${this.translate.instant('Customer')}</th>
          <td>${this.resolveCustomerName(item)}</td>
          <th>${this.translate.instant('Vehicle')}</th>
          <td>${this.resolveVehicleName(item)}</td>
        </tr>
        <tr>
          <th>${this.translate.instant('Booking')}</th>
          <td colspan="3">${this.resolveBookingName(item)}</td>
        </tr>
      </table>

      <div class="summary">${this.translate.instant('Total Amount')}: ${formatFinanceNumber(item.paid, this.translate)}</div>

      <div class="signatures">
        <div class="sig-box">${this.translate.instant('Prepared By')}</div>
        <div class="sig-box">${this.translate.instant('Reviewed By')}</div>
        <div class="sig-box">${this.translate.instant('Approved By')}</div>
      </div>
    `;
  }

  private resolveCustomerName(item: PaymentCount): string {
    const direct = String(item.customerName ?? '').trim();
    if (direct) return direct;
    const key = String(item.idCustomer ?? '').trim();
    if (!key) return '-';
    return this.customerNames()[key] || '-';
  }

  private resolveVehicleName(item: PaymentCount): string {
    const direct = String(
      (item as { vehicleName?: string; nameVehicle?: string; carName?: string }).vehicleName ??
        (item as { nameVehicle?: string }).nameVehicle ??
        (item as { carName?: string }).carName ??
        '',
    ).trim();
    if (direct) return direct;
    const key = String(item.idVehicle ?? '').trim();
    if (!key) return '-';
    return this.vehicleNames()[key] || '-';
  }

  private readBackendText(item: PaymentCount, keys: string[]): string {
    const source = item as unknown as Record<string, unknown>;
    for (const key of keys) {
      const value = source[key];
      if (value !== undefined && value !== null) {
        return String(value).trim();
      }
    }
    return '';
  }

  private resolveVehiclePrintDetailsFromBackend(item: PaymentCount): {
    name: string;
    plateNumber: string;
    yearMake: string;
    category: string;
  } {
    return {
      name: this.readBackendText(item, [
        'vehicleName',
        'VehicleName',
        'nameVehicle',
        'NameVehicle',
        'carName',
        'CarName',
      ]),
      plateNumber: this.readBackendText(item, [
        'plateNumber',
        'PlateNumber',
        'vehiclePlatnumber',
        'VehiclePlatnumber',
      ]),
      yearMake: this.readBackendText(item, ['yearMake', 'YearMake', 'vehicleYear', 'VehicleYear']),
      category: this.readBackendText(item, [
        'categoryVehicleName',
        'CategoryVehicleName',
        'vehicleCategory',
        'VehicleCategory',
        'categoryName',
        'CategoryName',
      ]),
    };
  }

  private resolveVoucherDetailsFromBackend(item: PaymentCount): Array<{
    account: string;
    amount: string;
    note: string;
  }> {
    const source = item as unknown as Record<string, unknown>;
    const rawDetails = source['details'] ?? source['Details'];
    if (!Array.isArray(rawDetails)) {
      return [];
    }

    return rawDetails
      .map(detail => {
        const row = (detail ?? {}) as Record<string, unknown>;
        const account = String(
          row['countingName'] ??
            row['CountingName'] ??
            row['accountName'] ??
            row['AccountName'] ??
            row['nameAr'] ??
            row['NameAr'] ??
            row['nameEn'] ??
            row['NameEn'] ??
            '',
        ).trim();
        const amount = String(row['price'] ?? row['Price'] ?? '').trim();
        const note = String(row['node'] ?? row['Node'] ?? '').trim();
        return {
          account: account || '.---.',
          amount: amount || '.---.',
          note: note || '.---.',
        };
      })
      .filter(row => row.account !== '.---.' || row.amount !== '.---.' || row.note !== '.---.');
  }

  private resolveBranchAddressFromBackend(item: PaymentCount): string {
    const city = this.readBackendText(item, ['branchCity', 'BranchCity']);
    const neighborhood = this.readBackendText(item, ['branchNeighborHood', 'BranchNeighborHood']);
    const street = this.readBackendText(item, ['branchStreet', 'BranchStreet']);
    const building = this.readBackendText(item, ['branchBuldingNumber', 'BranchBuldingNumber']);

    const parts = [city, neighborhood, street]
      .map(part => String(part ?? '').trim())
      .filter(Boolean);
    const buildingSuffix = String(building ?? '').trim();
    if (buildingSuffix) {
      parts.push(`No. ${buildingSuffix}`);
    }

    const composed = parts.join(' - ');
    if (composed) {
      return composed;
    }
    return this.readBackendText(item, ['branchName', 'BranchName']);
  }

  private resolveBranchName(item: PaymentCount): string {
    const direct = String(item.branchName ?? '').trim();
    if (direct) return direct;
    const key = String(item.idBranch ?? '').trim();
    if (!key) return '-';
    return this.branchNames()[key] || '-';
  }

  private resolveCashName(item: PaymentCount): string {
    const key = String(item.idCash ?? '').trim();
    if (!key) return '-';
    return this.cashNames()[key] || '-';
  }

  private resolveBankName(item: PaymentCount): string {
    const key = String(item.idBank ?? '').trim();
    if (!key) return '-';
    return this.bankNames()[key] || '-';
  }

  private resolveBookingName(item: PaymentCount): string {
    const key = String(item.idBooking ?? '').trim();
    if (!key) return '-';
    return this.bookingNames()[key] || '-';
  }
}
