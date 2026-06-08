import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { TranslateModule } from '@ngx-translate/core';
import { Subject, of, throwError } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { BookingService } from '../../../../rent/services/booking/booking.service';
import { BranchService } from '../../../../rent/services/branches/branch.service';
import { CustomerService } from '../../../../rent/services/customers/customer.service';
import { VehicleService } from '../../../../rent/services/vehicles/vehicle.service';
import { PaymentCount } from '../../../models/payment-counts/payment-count.model';
import { BankService } from '../../../services/banks/bank.service';
import { CashAccountService } from '../../../services/cash/cash-account.service';
import { PaymentCountService } from '../../../services/payment-counts/payment-count.service';
import { PaymentCountListComponent } from '../../payment-counts/payment-count-list/payment-count-list.component';

describe('PaymentCountListComponent', () => {
  let fixture: ComponentFixture<PaymentCountListComponent>;
  let component: PaymentCountListComponent;
  let paymentCountServiceSpy: jasmine.SpyObj<PaymentCountService>;
  let toastSpy: jasmine.SpyObj<ToastService>;

  const fleetId = '11111111-0000-0000-0000-000000000001';

  const mockPayments: PaymentCount[] = [
    {
      id: 'receipt-1',
      paymentNumber: 'RC-1001',
      paid: 250,
      status: 1,
      bondType: 2,
      paymentType: 1,
      idCustomer: 10,
      customerName: 'Ahmed Ali',
      idVehicle: 'vehicle-1',
      idBranch: 12,
      idCash: 'cash-1',
      paidCash: 250,
      paidBank: 0,
      idBooking: 44,
      details: [{ accountName: 'Daily Rental Revenue', price: 250, node: 'Receipt line' }],
    },
    {
      id: 'payment-1',
      paymentNumber: 'PY-2001',
      paid: 75,
      status: 2,
      bondType: 1,
      paymentType: 4,
      idCustomer: undefined,
      idVehicle: undefined,
      idBranch: 12,
      idBank: 'bank-1',
      paidCash: 0,
      paidBank: 75,
      idBooking: undefined,
    },
  ];

  function paginated(items: PaymentCount[] = mockPayments) {
    return {
      items,
      pageNumber: 1,
      pageSize: 10,
      totalCount: items.length,
      totalPages: Math.max(1, Math.ceil(items.length / 10)),
    };
  }

  function configure(paymentResponse = of(paginated())): void {
    paymentCountServiceSpy = jasmine.createSpyObj<PaymentCountService>('PaymentCountService', [
      'getPaginated',
      'getById',
    ]);
    paymentCountServiceSpy.getPaginated.and.returnValue(paymentResponse);
    paymentCountServiceSpy.getById.and.returnValue(of(mockPayments[0]));

    const customerServiceSpy = jasmine.createSpyObj<CustomerService>('CustomerService', ['getPaginated']);
    customerServiceSpy.getPaginated.and.returnValue(of({
      items: [
        {
          id: '10',
          fullName: 'Ahmed Ali',
          nameAr: 'أحمد علي',
          nameEn: 'Ahmed Ali',
          isActive: true,
        },
      ],
      pageNumber: 1,
      pageSize: 300,
      totalCount: 1,
      totalPages: 1,
    }));

    const vehicleServiceSpy = jasmine.createSpyObj<VehicleService>('VehicleService', ['getPaginated']);
    vehicleServiceSpy.getPaginated.and.returnValue(of({
      items: [
        {
          id: 'vehicle-1',
          fleetId,
          make: 'Toyota',
          model: 'Camry',
          year: 2024,
          yearMake: 2024,
          plateNumber: 'ABC-123',
          status: 'Available',
          isActive: true,
          categoryName: 'Sedan',
        },
      ],
      pageNumber: 1,
      pageSize: 300,
      totalCount: 1,
      totalPages: 1,
    }));

    const branchServiceSpy = jasmine.createSpyObj<BranchService>('BranchService', ['getList']);
    branchServiceSpy.getList.and.returnValue(of([
      { id: 12, nameAr: 'الفرع الرئيسي', nameEn: 'Main Branch', fleetId, isActive: true },
    ]) as any);

    const bookingServiceSpy = jasmine.createSpyObj<BookingService>('BookingService', ['getList']);
    bookingServiceSpy.getList.and.returnValue(of([
      {
        id: '44',
        bookingNumber: 'BK-44',
        customerId: '10',
        customerName: 'Ahmed Ali',
        vehicleId: 'vehicle-1',
        status: 'Confirmed',
        totalAmount: 250,
      },
    ]) as any);

    const bankServiceSpy = jasmine.createSpyObj<BankService>('BankService', ['getList']);
    bankServiceSpy.getList.and.returnValue(of([
      { id: 'bank-1', countingId: '1102', name: 'SNB', code: '1102' },
    ]));

    const cashServiceSpy = jasmine.createSpyObj<CashAccountService>('CashAccountService', ['getList']);
    cashServiceSpy.getList.and.returnValue(of([
      { id: 'cash-1', countingId: '1101', name: 'Main Cash', fleetId },
    ]));

    toastSpy = jasmine.createSpyObj<ToastService>('ToastService', ['success', 'error', 'warning', 'info']);

    TestBed.configureTestingModule({
      imports: [
        PaymentCountListComponent,
        NoopAnimationsModule,
        RouterTestingModule,
        TranslateModule.forRoot(),
      ],
      providers: [
        { provide: PaymentCountService, useValue: paymentCountServiceSpy },
        { provide: CustomerService, useValue: customerServiceSpy },
        { provide: VehicleService, useValue: vehicleServiceSpy },
        { provide: BranchService, useValue: branchServiceSpy },
        { provide: BookingService, useValue: bookingServiceSpy },
        { provide: BankService, useValue: bankServiceSpy },
        { provide: CashAccountService, useValue: cashServiceSpy },
        { provide: ToastService, useValue: toastSpy },
        { provide: AuthStateService, useValue: { fleetId: jasmine.createSpy('fleetId').and.returnValue(fleetId) } },
      ],
    });

    fixture = TestBed.createComponent(PaymentCountListComponent);
    component = fixture.componentInstance;
  }

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('creates the component without errors', () => {
    configure();

    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('loads paginated payment counts on init using the current fleet id', () => {
    configure();

    fixture.detectChanges();

    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledOnceWith(jasmine.objectContaining({
      fleetId,
      pageNumber: 1,
      pageSize: 10,
      search: '',
      orderBy: 'CreatedAt',
      orderByDirection: 'DESC',
    }));
    expect(component.items().length).toBe(2);
    expect(component.totalCount()).toBe(2);
  });

  it('displays receipt and payment voucher rows', () => {
    configure();

    fixture.detectChanges();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('RC-1001');
    expect(text).toContain('PY-2001');
    expect(text).toContain('Receipt Voucher');
    expect(text).toContain('Payment Voucher');
    expect(text).toContain('Cash');
    expect(text).toContain('Bank Transfer');
  });

  it('shows an empty state when the service returns an empty page', () => {
    configure(of(paginated([])));

    fixture.detectChanges();

    expect(component.items()).toEqual([]);
    expect(component.totalCount()).toBe(0);
    expect(fixture.nativeElement.textContent).toContain('Table empty hint');
  });

  it('shows and clears loading state around an in-flight paginated request', () => {
    const request$ = new Subject<ReturnType<typeof paginated>>();
    configure(request$.asObservable());

    fixture.detectChanges();

    expect(component.loading()).toBeTrue();
    expect(fixture.nativeElement.querySelector('.spinner-border')).not.toBeNull();

    request$.next(paginated());
    request$.complete();
    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('RC-1001');
  });

  it('debounces search and reloads with the normalized search value', fakeAsync(() => {
    configure();
    fixture.detectChanges();

    component.onSearchChange('  RC-1001  ');
    tick(350);

    expect(component.search()).toBe('RC-1001');
    expect(component.pageNumber()).toBe(1);
    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      search: 'RC-1001',
      pageNumber: 1,
    }));
  }));

  it('applies bond type, payment type, and branch filters through service params', () => {
    configure();
    fixture.detectChanges();

    component.onBondTypeFilterChange(2);
    component.onPaymentTypeFilterChange(1);
    component.onBranchFilterChange(12);

    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      bondTypePaymentcount: 2,
    }));
    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      bondTypePaymentcount: 2,
      paymentTypePaymentcount: 1,
    }));
    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      bondTypePaymentcount: 2,
      paymentTypePaymentcount: 1,
      branchId: 12,
    }));
  });

  it('applies sorting changes through service params', () => {
    configure();
    fixture.detectChanges();

    component.onOrderByChange('Paid');
    component.onOrderByDirectionChange('ASC');

    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      orderBy: 'Paid',
      orderByDirection: 'DESC',
      pageNumber: 1,
    }));
    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      orderBy: 'Paid',
      orderByDirection: 'ASC',
      pageNumber: 1,
    }));
  });

  it('applies pagination changes through service params', () => {
    configure();
    fixture.detectChanges();

    component.onPageChange(2);
    component.onPageSizeChange(20);

    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      pageNumber: 2,
      pageSize: 10,
    }));
    expect(paymentCountServiceSpy.getPaginated).toHaveBeenCalledWith(jasmine.objectContaining({
      pageNumber: 1,
      pageSize: 20,
    }));
  });

  it('loads voucher details for view action and opens the preview window', () => {
    configure();
    fixture.detectChanges();

    const fakeWindow = { location: { href: '' }, close: jasmine.createSpy('close') } as unknown as Window;
    spyOn(window, 'open').and.returnValue(fakeWindow);

    component.onRowAction({ actionKey: 'view', rowIndex: 0 });

    expect(paymentCountServiceSpy.getById).toHaveBeenCalledOnceWith('receipt-1', fleetId);
    expect(window.open).toHaveBeenCalled();
    expect(fakeWindow.location.href).toContain('/assets/pyment/invoise-view.html');
  });

  it('shows error state and toast when paginated load fails', () => {
    configure(throwError(() => new Error('Payment load failed')));

    fixture.detectChanges();

    expect(component.loading()).toBeFalse();
    expect(component.loadError()).toBe('Payment load failed');
    expect(toastSpy.error).toHaveBeenCalledWith('Payment load failed');
    expect(fixture.nativeElement.querySelector('.spinner-border')).not.toBeNull();
  });

  it('formats amount, date-independent labels, payment method, and null booking safely', () => {
    configure(of(paginated([
      {
        id: 'null-case',
        paymentNumber: undefined,
        paid: undefined,
        status: undefined,
        bondType: undefined,
        paymentType: undefined,
        idBooking: undefined,
        paidCash: undefined,
        paidBank: undefined,
      },
    ])));

    fixture.detectChanges();

    const row = component.rows()[0];
    expect(row['paymentNumber']).toBe('-');
    expect(row['amount']).toBe('-');
    expect(row['bondType']).toBe('Unknown');
    expect(row['paymentType']).toBe('Unknown');
    expect(row['booking']).toBe('-');
    expect(row['paidCash']).toBe('-');
    expect(row['paidBank']).toBe('-');
  });

  it('shows booking-linked payment information when booking lookup exists', () => {
    configure();

    fixture.detectChanges();

    const row = component.rows()[0];
    expect(row['booking']).toBe('BK-44 - Ahmed Ali');
    expect(row['customer']).toBe('Ahmed Ali');
    expect(row['vehicle']).toBe('ABC-123');
  });
});
