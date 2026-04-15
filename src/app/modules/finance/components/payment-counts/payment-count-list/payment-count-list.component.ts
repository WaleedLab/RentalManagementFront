import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { Subject, catchError, debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { BankService } from '../../../services/banks/bank.service';
import { CashAccountService } from '../../../services/cash/cash-account.service';
import { PaymentCount } from '../../../models/payment-counts/payment-count.model';
import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { PaymentCountService } from '../../../services/payment-counts/payment-count.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceNumber } from '../../shared/finance-list-formatters';
import { BookingService } from '../../../../rent/services/booking/booking.service';
import { BranchService } from '../../../../rent/services/branches/branch.service';
import { CustomerService } from '../../../../rent/services/customers/customer.service';
import { VehicleService } from '../../../../rent/services/vehicles/vehicle.service';

@Component({
  selector: 'app-payment-count-list',
  standalone: true,
  imports: [FinanceListShellComponent],
  templateUrl: './payment-count-list.component.html',
  styleUrl: './payment-count-list.component.scss',
})
export class PaymentCountListComponent implements OnInit {
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
  readonly orderByOptions: SmoothSelectOption[] = [
    { label: 'Created At', value: 'CreatedAt' },
    { label: 'Paid', value: 'Paid' },
    { label: 'Updated At', value: 'UpdatedAt' },
  ];

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
        .getPaginated({ fleetId, pageNumber: 1, pageSize: 300, search: '' })
        .pipe(catchError(() => of({ items: [] }))),
      bookings: this.bookingService
        .getPaginated({ fleetId, pageNumber: 1, pageSize: 300, search: '' })
        .pipe(catchError(() => of({ items: [] }))),
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cash: this.cashAccountService.getList(fleetId).pipe(catchError(() => of([]))),
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
        for (const vehicle of vehicles.items ?? []) {
          const key = String(vehicle.id ?? '').trim();
          if (!key) continue;
          const title = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
          const plate = vehicle.plateNumber?.trim() || '';
          vehicleDict[key] = [title, plate].filter(Boolean).join(' - ') || '-';
        }
        this.vehicleNames.set(vehicleDict);

        const branchDict: Record<string, string> = {};
        for (const branch of branches.items ?? []) {
          const key = String(branch.id ?? '').trim();
          if (!key) continue;
          const name = (isArabic ? branch.nameAr : branch.nameEn) || branch.nameAr || branch.nameEn || '';
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
        this.pageSize.set(response.pageSize || requestedPageSize);
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

  private resolveCustomerName(item: PaymentCount): string {
    const direct = String(item.customerName ?? '').trim();
    if (direct) return direct;
    const key = String(item.idCustomer ?? '').trim();
    if (!key) return '-';
    return this.customerNames()[key] || '-';
  }

  private resolveVehicleName(item: PaymentCount): string {
    const direct = String((item as { vehicleName?: string }).vehicleName ?? '').trim();
    if (direct) return direct;
    const key = String(item.idVehicle ?? '').trim();
    if (!key) return '-';
    return this.vehicleNames()[key] || '-';
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

