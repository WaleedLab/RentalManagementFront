import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import {
  coerceFormNumber,
  isEmptyNumericValue,
  requiredNumber,
} from '../../../../../shared/validators/required-number.validator';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import {
  Observable,
  Subject,
  catchError,
  distinctUntilChanged,
  forkJoin,
  map,
  merge,
  of,
  startWith,
  switchMap,
} from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { resolveContractPaymentBranch } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { Bank } from '../../../../finance/models/banks/bank.model';
import { CashAccount } from '../../../../finance/models/cash/cash-account.model';
import { CountingEntry } from '../../../../finance/models/counting/counting-entry.model';
import { PaymentCount } from '../../../../finance/models/payment-counts/payment-count.model';
import { BankService } from '../../../../finance/services/banks/bank.service';
import { CashAccountService } from '../../../../finance/services/cash/cash-account.service';
import { CountingEntryService } from '../../../../finance/services/counting/counting-entry.service';
import { PaymentCountService } from '../../../../finance/services/payment-counts/payment-count.service';
import {
  Booking,
  BookingCreateRequest,
  BookingUpdateRequest,
  CategoryVehicle,
  Customer,
  Vehicle,
  paidForBookingUpdateRequest,
} from '../../../models';
import { Setting } from '../../../models/settings/setting.model';
import { normalizeSetting } from '../../../models/settings/setting.normalizer';
import { BookingService } from '../../../services/booking/booking.service';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';
import { CustomerService } from '../../../services/customers/customer.service';
import { SettingService } from '../../../services/settings/setting.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import {
  type BookingNationalitySuggestion,
  searchBookingNationalities,
} from './booking-nationality.options';

@Component({
  selector: 'app-booking-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    PageHeaderComponent,
    SmoothSelectComponent,
    DatePickerComponent,
    ...SHARED_FORM_FIELD_DIRECTIVES,
  ],
  templateUrl: './booking-form.component.html',
  styleUrl: './booking-form.component.scss',
})
export class BookingFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  /** Default revenue counting used for booking customer vehicle ledger. */
  private static readonly DEFAULT_CUSTOMER_VEHICLE_COUNTING_NUMBER = 4101;
  private static readonly NATIONAL_ID_LENGTH = 10;
  private static readonly NATIONAL_ID_REGEX = /^\d{10}$/;
  private static readonly GPS_DISTANCE_REGEX = /^[A-Za-z0-9\s.,/-]{0,100}$/;
  private static readonly PLACE_USE_REGEX = /^[\u0600-\u06FFA-Za-z0-9\s.,'-]{0,200}$/;
  private static readonly NOTE_REGEX = /^[\u0600-\u06FFA-Za-z0-9\s.,!?'"\-_/()]{0,500}$/;
  private static readonly BASAME_NUMBER_REGEX = /^[A-Za-z0-9-]{0,10}$/;

  /** Not shown on create UI — empty `null` blocks submit via `requiredNumber`. */
  private static readonly HIDDEN_NUMERIC_DEFAULT_KEYS = [
    'numberOfHoursExcess',
    'numberKmExcess',
    'dayExcess',
    'discount',
    'checkinCounter',
    'priceInMonth',
    'allowTo',
    'countKMExtra',
    'otherExpenses',
    'totalTrafic',
    'totalMaintance',
    'totalReceivedVehicle',
    'transportationFees',
    'totaltax',
    'paid',
    'paidCash',
    'paidBank',
    'priceDayBandLow',
    'priceDayBandHigh',
    'priceHourExtraBandLow',
    'priceHourExtraBandHigh',
    'priceKmExtraBandLow',
    'priceKmExtraBandHigh',
  ] as const;

  private static readonly FORM_CONTROL_LABEL_KEYS: Record<string, string> = {
    customerIqama: 'Identity Number',
    vehicleId: 'Vehicle',
    startDate: 'Start Date',
    endDate: 'End Date',
    dateReturnVehical: 'Return Vehicle Date',
    countOfDay: 'Count Of Days',
    checkoutCounter: 'Checkout Counter',
    priceInDay: 'Price Per Day',
    priceHoureExtra: 'Extra Hour Price',
    priceKmExtra: 'Extra KM Price',
    numberBookingINBasame: 'Rental Contract Number',
    paid: 'Paid',
    idBank: 'Bank Account',
    idCash: 'Cash Account',
    distancetraveledgps: 'Travelled Distance GPS',
    note: 'Notes',
    placeUSE: 'Place Of Use',
  };

  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private authState = inject(AuthStateService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private bookingService = inject(BookingService);
  private customerService = inject(CustomerService);
  private vehicleService = inject(VehicleService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private bankService = inject(BankService);
  private cashAccountService = inject(CashAccountService);
  private countingEntryService = inject(CountingEntryService);
  private paymentCountService = inject(PaymentCountService);
  private settingsApi = inject(SettingService);
  private destroyRef = inject(DestroyRef);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  bookingSettings = signal<Setting | null>(null);
  showBookingDistanceGpsEnabled = computed(
    () => this.bookingSettings()?.showBookingDistanceGps ?? true,
  );
  contractLimitWarnings = signal<string[]>([]);
  /** Shown under contract price fields when the value is outside the category band (no auto-clamp). */
  contractPriceBandHintDaily = signal<string | null>(null);
  contractPriceBandHintHour = signal<string | null>(null);
  contractPriceBandHintKm = signal<string | null>(null);

  customers = signal<Customer[]>([]);
  private readonly selectedCustomerId = signal('');
  readonly selectedCustomer = computed(() => {
    const id = this.selectedCustomerId();
    if (!id) {
      return null;
    }
    return this.customers().find(customer => String(customer.id) === id) ?? null;
  });
  vehicles = signal<Vehicle[]>([]);
  categories = signal<CategoryVehicle[]>([]);
  banks = signal<Bank[]>([]);
  cashAccounts = signal<CashAccount[]>([]);
  countingEntries = signal<CountingEntry[]>([]);
  // customerIqamaSuggestions = signal<Customer[]>([]);
  // activeCustomerSuggestionIndex = signal(-1);
  /** Category matched to the selected vehicle (pricing bands). */
  selectedCategory = signal<CategoryVehicle | null>(null);
  /** True when a vehicle is selected but no category row could be loaded (for hints). */
  categoryHintUnavailable = signal(false);
  private readonly vehicleCategoryHintsTrigger$ = new Subject<void>();
  loading = signal(false);
  paymentRows = signal<PaymentCount[]>([]);
  paymentCountSum = signal<number | null>(null);
  lastPayment = signal<PaymentCount | null>(null);
  lastPaymentIsPosting = signal(false);
  editVehicleId = signal('');
  editVehiclePlate = signal('');
  vehiclePlateLookup = signal('');
  editBookingId = signal<number | null>(null);
  originalPaidSnapshot = signal<number | null | undefined>(undefined);
  editMode = computed(() => this.editBookingId() !== null);
  private readonly i18nTick = signal(0);
  customerSelectOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
    { label: this.translate.instant('Select customer'), value: '' },
    ...this.customers().map(customer => ({
      label: customer.fullName || customer.nameAr || customer.nameEn || '-',
      value: String(customer.id),
    })),
  ];
  });
  vehicleSelectOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    const baseOptions: SmoothSelectOption[] = [
      { label: this.translate.instant('Select vehicle'), value: '' },
      ...this.vehicles().map(vehicle => ({
        label: vehicle.plateNumber || vehicle.serialNumber || vehicle.make || '-',
        value: String(vehicle.id),
      })),
    ];
    const currentId = this.editVehicleId().trim();
    const currentPlate = this.editVehiclePlate().trim();
    if (!currentId) {
      return baseOptions;
    }
    const exists = baseOptions.some(option => String(option.value) === currentId);
    if (exists) {
      return baseOptions;
    }
    return [
      ...baseOptions,
      {
        label: currentPlate || currentId,
        value: currentId,
      },
    ];
  });
  bankSelectOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
    { label: this.translate.instant('Select bank'), value: '' },
    ...this.banks().map(bank => ({
      label: bank.name || '-',
      value: String(bank.id),
    })),
  ];
  });
  cashSelectOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
    { label: this.translate.instant('Select cash account'), value: '' },
    ...this.cashAccounts().map(cash => ({
      label: cash.name || '-',
      value: String(cash.id),
    })),
  ];
  });
  paymentTypeSelectOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
    { label: this.translate.instant('Cash'), value: 1 },
    { label: this.translate.instant('Network/POS'), value: 2 },
    { label: this.translate.instant('Cheque'), value: 3 },
    { label: this.translate.instant('Bank Transfer'), value: 4 },
    { label: this.translate.instant('Bank/Cash'), value: 5 },
  ];
  });
  discountTypeSelectOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
    { label: this.translate.instant('Fixed Amount'), value: 'amount' },
    { label: this.translate.instant('Percentage'), value: 'percent' },
  ];
  });
  countingSelectOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
    { label: this.translate.instant('Select customer vehicle counting'), value: '' },
    ...this.countingEntries().map(counting => ({
      label: [counting.nameAr, counting.nameEn].filter(Boolean).join(' - ') || String(counting.id),
      value: String(counting.id),
    })),
  ];
  });
  nationalitySuggestions = signal<BookingNationalitySuggestion[]>([]);
  nationalitySuggestionsOpen = signal(false);

  private readonly customerBasicFields: Array<{
    label: string;
    resolver: (customer: Customer) => string;
    /** When set, this field can show auxiliary text in `resolver` but still block booking until true. */
    isComplete?: (customer: Customer) => boolean;
  }> = [
    {
      label: 'Identity Number',
      resolver: customer => this.valueOf(customer.idNationality ?? customer.identityNumber),
    },
    {
      label: 'Arabic Name',
      resolver: customer => this.valueOf(customer.nameAr ?? customer.fullName),
    },
    {
      label: 'Nationality',
      resolver: customer => this.valueOf(customer.nationality),
    },
    {
      label: 'Primary Mobile Number',
      resolver: customer => this.valueOf(customer.firstMobileNumber ?? customer.phoneNumber),
    },
    {
      label: 'Driving License Expiry Date',
      resolver: customer =>
        this.valueOf(
          customer.dateDrivinglicense ??
            customer.drivingLicenseExpiryDate ??
            customer.dateDrivinglicenseHajri,
        ),
      isComplete: customer => Boolean(this.drivingLicenseDateForBookingApi(customer).api),
    },
    {
      label: 'Driving License Number',
      resolver: customer => this.valueOf(customer.licenceNo ?? customer.drivingLicenseNumber),
    },
    {
      label: 'Address',
      resolver: customer => this.valueOf(customer.address),
    },
    {
      label: 'Date of Birth',
      resolver: customer => this.valueOf(customer.birthDay ?? customer.dateOfBirth),
    },
  ];

  form = this.fb.group({
    fleetId: [this.authState.fleetId() || '', [Validators.required]],
    branchId: [Number(this.authState.branchId() || 0), [Validators.required, Validators.min(1)]],
    customerId: [''],
    customerIqama: [
      '',
      [
        Validators.required,
        Validators.minLength(BookingFormComponent.NATIONAL_ID_LENGTH),
        Validators.maxLength(BookingFormComponent.NATIONAL_ID_LENGTH),
        Validators.pattern(BookingFormComponent.NATIONAL_ID_REGEX),
      ],
    ],
    customerNameAr: ['', [Validators.maxLength(200)]],
    customerFirstMobileNumber: ['', [Validators.maxLength(20)]],
    customerAddress: ['', [Validators.maxLength(500)]],
    customerNationality: ['', [Validators.maxLength(200)]],
    customerDrivingLicenseNumber: ['', [Validators.maxLength(50)]],
    customerDateDrivinglicense: [''],
    customerBirthDay: [''],
    vehicleId: ['', [Validators.required]],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    dateReturnVehical: ['', [Validators.required]],
    distancetraveledgps: [
      '',
      [Validators.maxLength(100), Validators.pattern(BookingFormComponent.GPS_DISTANCE_REGEX)],
    ],
    numberOfHoursExcess: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    numberKmExcess: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    dayExcess: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    discountType: ['amount' as 'amount' | 'percent'],
    discount: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    checkoutCounter: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    checkinCounter: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    countOfDay: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 1 })]),
    priceInDay: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    /** Category / policy daily band — editable; contract daily defaults to upper band when no vehicle rate. */
    priceDayBandLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceDayBandHigh: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceInMonth: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    allowTo: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    countKMExtra: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceHoureExtra: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceHourExtraBandLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceHourExtraBandHigh: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceKmExtra: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceKmExtraBandLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceKmExtraBandHigh: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    otherExpenses: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    total: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    note: ['', [Validators.maxLength(500), Validators.pattern(BookingFormComponent.NOTE_REGEX)]],
    placeUSE: [
      '',
      [Validators.maxLength(200), Validators.pattern(BookingFormComponent.PLACE_USE_REGEX)],
    ],
    totalTrafic: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    totalMaintance: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    totalReceivedVehicle: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    transportationFees: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    totaltax: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    paid: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    paidCash: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    paidBank: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    paymentType: [1, [Validators.required, Validators.min(1)]],
    idBank: [''],
    idCash: [''],
    idCountingCustVehicle: [''],
    numberBookingINBasame: [
      '',
      [
        Validators.required,
        Validators.maxLength(10),
        Validators.pattern(BookingFormComponent.BASAME_NUMBER_REGEX),
      ],
    ],
  });

  ngOnInit(): void {
    const routeId = Number(this.route.snapshot.paramMap.get('id'));
    this.editBookingId.set(Number.isFinite(routeId) && routeId > 0 ? routeId : null);

    this.form.controls.dateReturnVehical.disable({ emitEvent: false });
    this.form.controls.customerId.valueChanges
      .pipe(
        startWith(this.form.controls.customerId.value),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(id => this.selectedCustomerId.set(String(id ?? '').trim()));

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.i18nTick.update(v => v + 1);
      this.refreshNationalitySuggestionList();
    });

    const fleetId = this.authState.fleetId() || undefined;
    const branchId = Number(this.authState.branchId() || 0) || undefined;
    const cashBranchId = resolveContractPaymentBranch({
      bookingBranchId: branchId,
      loginBranchId: this.authState.branchId(),
    });
    forkJoin({
      // customers: this.customerService.getPaginated({
      //   fleetId,
      //   pageNumber: 1,
      //   pageSize: 100,
      //   isActive: true,
      // }),
      vehicles: this.vehicleService.getList({
        fleetId,
        branchId,
        status: 'Available',
      }),
      categories: this.categoryVehicleService.getList(fleetId).pipe(catchError(() => of([]))),
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cashAccounts: this.cashAccountService.getList(fleetId, cashBranchId).pipe(catchError(() => of([]))),
      countingEntries: this.countingEntryService.getList(fleetId).pipe(catchError(() => of([]))),
      settings: this.settingsApi.getCurrent(fleetId).pipe(
        catchError(() =>
          of(
            normalizeSetting({
              fleetId,
              showBookingDistanceGps: true,
            }),
          ),
        ),
      ),
    }).subscribe({
      next: ({ vehicles, categories, banks, cashAccounts, countingEntries, settings }) => {
        // this.customers.set(customers.items ?? []);
        this.vehicles.set(vehicles ?? []);
        this.categories.set(categories ?? []);
        this.banks.set(banks ?? []);
        this.cashAccounts.set(cashAccounts ?? []);
        this.countingEntries.set(countingEntries ?? []);
        this.bookingSettings.set(settings);
        if (settings.id > 0) {
          this.form.controls.totaltax.disable({ emitEvent: false });
        } else {
          this.form.controls.totaltax.enable({ emitEvent: false });
        }
        this.applyAutoTaxFromSettings();
        this.refreshContractLimitWarnings();
        this.refreshContractBandPriceHints();
        this.applyDefaultCustomerVehicleCounting();
        this.vehicleCategoryHintsTrigger$.next();
        if (this.editMode()) {
          this.loadBookingForEdit();
        }
      },
      error: () => this.toast.error(this.translate.instant('Failed to load booking references')),
    });

    merge(this.form.controls.vehicleId.valueChanges, this.vehicleCategoryHintsTrigger$)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(() => this.loadCategoryForSelectedVehicle$()),
      )
      .subscribe(({ vehicle, cat }) => {
        this.selectedCategory.set(cat);
        this.categoryHintUnavailable.set(Boolean(vehicle) && !cat);
        if (!vehicle) {
          this.form.patchValue(
            {
              priceDayBandLow: 0,
              priceDayBandHigh: 0,
              priceHourExtraBandLow: 0,
              priceHourExtraBandHigh: 0,
              priceKmExtraBandLow: 0,
              priceKmExtraBandHigh: 0,
            },
            { emitEvent: false },
          );
          this.refreshContractBandPriceHints();
          return;
        }
        this.patchFormFromVehicleAndCategory(vehicle, cat ?? undefined);
      });

    merge(this.form.controls.startDate.valueChanges, this.form.controls.countOfDay.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncDatesFromStartAndDays());

    merge(
      this.form.controls.countOfDay.valueChanges,
      this.form.controls.priceInDay.valueChanges,
      this.form.controls.priceHoureExtra.valueChanges,
      this.form.controls.priceKmExtra.valueChanges,
      this.form.controls.discount.valueChanges,
      this.form.controls.discountType.valueChanges,
      this.form.controls.numberOfHoursExcess.valueChanges,
      this.form.controls.numberKmExcess.valueChanges,
      this.form.controls.dayExcess.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.applyAutoTaxFromSettings();
        this.syncBookingTotals();
        this.refreshContractLimitWarnings();
        this.refreshContractBandPriceHints();
      });

    merge(
      this.form.controls.priceDayBandLow.valueChanges,
      this.form.controls.priceDayBandHigh.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.normalizeBandPair('priceDayBandLow', 'priceDayBandHigh');
        this.applyAutoTaxFromSettings();
        this.syncBookingTotals();
        this.refreshContractLimitWarnings();
        this.refreshContractBandPriceHints();
      });

    merge(
      this.form.controls.priceHourExtraBandLow.valueChanges,
      this.form.controls.priceHourExtraBandHigh.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.normalizeBandPair('priceHourExtraBandLow', 'priceHourExtraBandHigh');
        this.applyAutoTaxFromSettings();
        this.syncBookingTotals();
        this.refreshContractLimitWarnings();
        this.refreshContractBandPriceHints();
      });

    merge(
      this.form.controls.priceKmExtraBandLow.valueChanges,
      this.form.controls.priceKmExtraBandHigh.valueChanges,
    )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.normalizeBandPair('priceKmExtraBandLow', 'priceKmExtraBandHigh');
        this.applyAutoTaxFromSettings();
        this.syncBookingTotals();
        this.refreshContractLimitWarnings();
        this.refreshContractBandPriceHints();
      });

    this.form.controls.totaltax.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.syncBookingTotals();
        this.refreshContractLimitWarnings();
      });

    this.form.controls.customerIqama.valueChanges
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        map(value => this.normalizeNationalId((value ?? '').trim())),
        distinctUntilChanged(),
        switchMap(iqama => {
          if (!iqama) {
            this.form.patchValue({ customerId: '' }, { emitEvent: false });
            this.selectedCustomerId.set('');
            return of<Customer[]>([]);
          }
          if (iqama.length < BookingFormComponent.NATIONAL_ID_LENGTH) {
            this.form.patchValue({ customerId: '' }, { emitEvent: false });
            this.selectedCustomerId.set('');
            return of<Customer[]>([]);
          }
          if (iqama.length > BookingFormComponent.NATIONAL_ID_LENGTH) {
            return of<Customer[]>([]);
          }
          this.customerLookupByIqama(iqama);
          return of<Customer[]>([]);
        }),
      )
      .subscribe(() => {
        // this.customerIqamaSuggestions.set([]);
        // this.activeCustomerSuggestionIndex.set(-1);
      });

    this.form.controls.paymentType.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(type => this.applyPaymentTypeRules(type));

    this.form.controls.paid.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.syncPaidByType());

    merge(this.form.controls.paidCash.valueChanges, this.form.controls.paidBank.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        if (this.form.controls.paymentType.value === 5) {
          const cash = Math.max(0, Number(this.form.controls.paidCash.value) || 0);
          const bank = Math.max(0, Number(this.form.controls.paidBank.value) || 0);
          this.form.patchValue(
            { paid: Math.round((cash + bank) * 100) / 100 },
            { emitEvent: false },
          );
        }
      });

    this.applyPaymentTypeRules(this.form.controls.paymentType.value);
    this.applyAutoTaxFromSettings();
    this.seedHiddenNumericDefaults();
    this.syncBookingTotals();
    this.refreshContractLimitWarnings();
  }

  save(): void {
    this.prepareFormBeforeSave();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const fieldLabel = this.firstInvalidControlLabel();
      const base = this.translate.instant(
        'Booking data is incomplete. Please fill in the required fields.',
      );
      this.toast.error(fieldLabel ? `${base} (${fieldLabel})` : base);
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    if (new Date(raw.endDate) < new Date(raw.startDate)) {
      this.toast.error(this.translate.instant('End date cannot be before start date'));
      return;
    }
    if (new Date(raw.dateReturnVehical) < new Date(raw.startDate)) {
      this.toast.error(this.translate.instant('Return date cannot be before start date'));
      return;
    }

    const selectedCustomer = this.selectedCustomer();
    const iqamaValue = this.normalizeNationalId(raw.customerIqama.trim());
    const fleetId =
      this.normalizeGuidOrUndefined(this.normalizeAsciiDigits(raw.fleetId.trim())) ?? '';
    if (!iqamaValue) {
      this.toast.error(this.translate.instant('Identity Number'));
      return;
    }
    if (!BookingFormComponent.NATIONAL_ID_REGEX.test(iqamaValue)) {
      this.toast.error(this.translate.instant('Identity Number must be 10 digits'));
      return;
    }
    if (!fleetId) {
      this.toast.error(this.translate.instant('Booking invalid fleet id'));
      return;
    }

    const startApi = this.bookingCalendarDateToApi(raw.startDate);
    const returnApi = this.bookingCalendarDateToApi(raw.dateReturnVehical);
    const endApi = returnApi;
    if (!startApi || !returnApi) {
      this.toast.error(this.translate.instant('Booking invalid contract dates'));
      return;
    }

    if (!this.validatePaymentInputs()) {
      return;
    }

    const settings = this.bookingSettings();
    if (settings && settings.id > 0) {
      const minPaidAtBooking = Math.max(0, Number(settings.minValue) || 0);
      const paidAtBooking = Math.max(0, Number(raw.paid) || 0);
      if (paidAtBooking < minPaidAtBooking) {
        this.toast.error(
          this.translate.instant('Booking minimum paid at create not met', {
            min: minPaidAtBooking,
            paid: paidAtBooking,
          }),
        );
        return;
      }
    }

    const contractWarnings = this.buildContractLimitWarnings();
    if (contractWarnings.length > 0) {
      const title = this.translate.instant('Booking contract limits exceeded title');
      this.toast.error(`${title}: ${contractWarnings[0]}`);
      return;
    }

    let nameArOut = '';
    let firstMobileNumberOut = '';
    let addressOut = '';
    let nationalityOut = '';
    let drivingLicenseApi = '';
    let birthDayOut = '';
    let idCustomerOut = 0;
    let customerLicenseExpired = false;
    let customerNationalityExpired = false;

    if (selectedCustomer) {
      const missingCustomerBasics = this.getMissingCustomerBasicFields(selectedCustomer);
      if (missingCustomerBasics.length > 0) {
        const message = this.translate.instant(
          'Complete customer basic information before booking',
        );
        this.toast.error(`${message}: ${missingCustomerBasics.join('، ')}`);
        return;
      }

      const licenseResult = this.drivingLicenseDateForBookingApi(selectedCustomer);
      if (licenseResult.hijriPrimaryBlocked) {
        this.toast.error(this.translate.instant('Booking license hijri not accepted'));
        return;
      }
      if (!licenseResult.api) {
        this.toast.error(
          this.translate.instant(
            licenseResult.needGregorianHint
              ? 'Booking license need Gregorian in customer profile'
              : 'Customer license date invalid for booking API',
          ),
        );
        return;
      }

      birthDayOut = this.resolveCustomerBirthForBookingApi(selectedCustomer);
      if (!birthDayOut) {
        this.toast.error(this.translate.instant('Booking missing customer birth date'));
        return;
      }

      nameArOut = (selectedCustomer.nameAr || selectedCustomer.fullName || '').trim();
      firstMobileNumberOut = this.normalizeSaudiMobile(
        this.normalizeAsciiDigits(
          (selectedCustomer.firstMobileNumber || selectedCustomer.phoneNumber || '').trim(),
        ),
      );
      addressOut = (selectedCustomer.address || '').trim();
      nationalityOut = (selectedCustomer.nationality || '').trim();
      drivingLicenseApi = licenseResult.api;
      customerLicenseExpired = this.isIsoDateExpired(drivingLicenseApi);
      {
        const nationalityExpiryIsoPrimary = this.customerDateFieldToApi(
          selectedCustomer.dateIdNationality ?? '',
        );
        const nationalityExpiryIsoFallback = this.customerDateFieldToApi(nationalityOut);
        const nationalityExpiryIso = nationalityExpiryIsoPrimary || nationalityExpiryIsoFallback;
        customerNationalityExpired = this.isIsoDateExpired(nationalityExpiryIso);
      }
      const parsedCustomerId = this.parseFormNumber(raw.customerId);
      idCustomerOut =
        Number.isFinite(parsedCustomerId) && parsedCustomerId > 0
          ? parsedCustomerId
          : Number(selectedCustomer.id) || 0;
    } else {
      const manualNameAr = raw.customerNameAr.trim();
      const manualMobile = this.normalizeSaudiMobile(
        this.normalizeAsciiDigits(raw.customerFirstMobileNumber.trim()),
      );
      const manualNationality = raw.customerNationality.trim();
      const manualLicense = this.bookingCalendarDateToApi(raw.customerDateDrivinglicense);
      const manualBirth = this.bookingCalendarDateToApi(raw.customerBirthDay);
      if (!manualNameAr || !manualMobile || !manualNationality || !manualLicense || !manualBirth) {
        this.toast.error(
          this.translate.instant('Complete customer basic information before booking'),
        );
        return;
      }
      nameArOut = manualNameAr;
      firstMobileNumberOut = manualMobile;
      addressOut = raw.customerAddress.trim();
      nationalityOut = manualNationality;
      drivingLicenseApi = manualLicense;
      customerLicenseExpired = this.isIsoDateExpired(drivingLicenseApi);
      customerNationalityExpired = this.isIsoDateExpired(
        this.customerDateFieldToApi(nationalityOut),
      );
      birthDayOut = manualBirth;
      idCustomerOut = 0;
    }

    const idVehicle = this.parseFormNumber(raw.vehicleId);
    const idCustomer = idCustomerOut;
    const selectedVehicle = this.selectedVehicle();
    const idBranch = resolveContractPaymentBranch({
      vehicleBranchId: selectedVehicle?.branchId,
      bookingBranchId: this.parseFormNumber(raw.branchId),
      loginBranchId: this.authState.branchId(),
    });
    const idBank = this.normalizeGuidOrUndefined(raw.idBank.trim());
    const idCash = this.normalizeGuidOrUndefined(raw.idCash.trim());
    const idCountingCustVehicle =
      this.normalizeGuidOrUndefined(raw.idCountingCustVehicle.trim()) ??
      this.defaultCustomerVehicleCountingId();
    if (!Number.isFinite(idVehicle) || idVehicle <= 0) {
      this.toast.error(this.translate.instant('Booking invalid vehicle selection'));
      return;
    }
    if (!Number.isFinite(idBranch) || idBranch <= 0) {
      this.toast.error(this.translate.instant('Booking invalid branch id'));
      return;
    }

    const settingsForRestrictions = this.bookingSettings();
    const vehicleRegistrationIso = this.customerDateFieldToApi(
      selectedVehicle?.validityCarRegistration ??
        selectedVehicle?.operatinCard ??
        selectedVehicle?.licenseExpirationDate ??
        '',
    );
    const vehicleInsuranceIso = this.customerDateFieldToApi(
      selectedVehicle?.insuranceExpires ?? '',
    );
    const vehicleRegistrationExpired = this.isIsoDateExpired(vehicleRegistrationIso);
    const vehicleInsuranceExpired = this.isIsoDateExpired(vehicleInsuranceIso);
    const vehicleRegistrationAndInsuranceExpired =
      vehicleRegistrationExpired && vehicleInsuranceExpired;

    if (settingsForRestrictions && settingsForRestrictions.id > 0) {
      if (
        customerLicenseExpired &&
        customerNationalityExpired &&
        !settingsForRestrictions.dateOfExpWithNation
      ) {
        this.toast.error(
          this.translate.instant('Booking restriction license and nationality expired not allowed'),
        );
        return;
      }
      if (
        customerLicenseExpired &&
        !customerNationalityExpired &&
        !settingsForRestrictions.dateOfExp
      ) {
        this.toast.error(this.translate.instant('Booking restriction license expired not allowed'));
        return;
      }
      if (
        vehicleRegistrationAndInsuranceExpired &&
        !settingsForRestrictions.expDateAndInsuranceExp
      ) {
        this.toast.error(
          this.translate.instant(
            'Booking restriction vehicle registration and insurance expired not allowed',
          ),
        );
        return;
      }
    }

    const body: BookingCreateRequest = {
      nameAr: nameArOut,
      firstMobileNumber: firstMobileNumberOut,
      address: addressOut,
      idNationality: iqamaValue,
      dateDrivinglicense: drivingLicenseApi,
      nationality: nationalityOut,
      idVehicle,
      checkoutCounter: coerceFormNumber(raw.checkoutCounter),
      total: coerceFormNumber(raw.total),
      startDate: startApi,
      endDate: endApi,
      countOfDay: coerceFormNumber(raw.countOfDay, 1),
      dateReturnVehical: returnApi,
      priceInDay: coerceFormNumber(raw.priceInDay),
      allowTo: coerceFormNumber(raw.allowTo),
      countKMExtra: coerceFormNumber(raw.countKMExtra),
      priceHoureExtra: coerceFormNumber(raw.priceHoureExtra),
      idBank,
      idCash,
      note: raw.note.trim() || undefined,
      placeUSE: raw.placeUSE.trim() || undefined,
      paidCash: coerceFormNumber(raw.paidCash),
      paidBank: coerceFormNumber(raw.paidBank),
      paymentType: raw.paymentType,
      idCountingCustVehicle,
      birthDay: birthDayOut,
      numberBookingINBasame: raw.numberBookingINBasame.trim(),
      fleetId,
      idBranch,
      idCustomer,
      distancetraveledgps: this.showBookingDistanceGpsEnabled()
        ? raw.distancetraveledgps.trim() || undefined
        : undefined,
      numberOfHoursExcess: coerceFormNumber(raw.numberOfHoursExcess),
      numberKmExcess: coerceFormNumber(raw.numberKmExcess),
      dayExcess: coerceFormNumber(raw.dayExcess),
      discount: coerceFormNumber(raw.discount),
      checkinCounter: coerceFormNumber(raw.checkinCounter),
      priceInMonth: coerceFormNumber(raw.priceInMonth),
      priceKmExtra: coerceFormNumber(raw.priceKmExtra),
      otherExpenses: coerceFormNumber(raw.otherExpenses),
      totalTrafic: coerceFormNumber(raw.totalTrafic),
      totalMaintance: coerceFormNumber(raw.totalMaintance),
      totalReceivedVehicle: coerceFormNumber(raw.totalReceivedVehicle),
      transportationFees: coerceFormNumber(raw.transportationFees),
      totaltax: coerceFormNumber(raw.totaltax),
      paid: coerceFormNumber(raw.paid),
    };

    if (this.editMode() && this.editBookingId()) {
      this.updateBooking(raw, {
        idCustomer,
        idVehicle,
        idBranch,
        idBank,
        idCash,
        idCountingCustVehicle,
      });
      return;
    }

    this.loading.set(true);
    this.bookingService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Booking created'));
        this.router.navigate(['/booking']);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        if (err instanceof HttpErrorResponse) {
          const apiMessage =
            this.valueOf((err.error as { message?: string } | null)?.message) ||
            this.valueOf((err.error as { title?: string } | null)?.title) ||
            this.valueOf(err.message);
          this.toast.error(apiMessage || this.translate.instant('Booking create failed'));
          return;
        }
        this.toast.error(this.bookingCreateErrorMessage(err));
      },
      complete: () => this.loading.set(false),
    });
  }

  private updateBooking(
    raw: ReturnType<typeof this.form.getRawValue>,
    ids: {
      idCustomer: number;
      idVehicle: number;
      idBranch: number;
      idBank?: string;
      idCash?: string;
      idCountingCustVehicle?: string;
    },
  ): void {
    const bookingId = this.editBookingId();
    if (!bookingId) {
      return;
    }
    const payload: BookingUpdateRequest = {
      id: bookingId,
      idCustomer: ids.idCustomer > 0 ? ids.idCustomer : undefined,
      idVehicle: ids.idVehicle,
      idBranch: ids.idBranch,
      checkoutCounter: coerceFormNumber(raw.checkoutCounter),
      checkinCounter: coerceFormNumber(raw.checkinCounter),
      countOfDay: coerceFormNumber(raw.countOfDay, 1),
      total: coerceFormNumber(raw.total),
      discount: coerceFormNumber(raw.discount),
      priceInDay: coerceFormNumber(raw.priceInDay),
      priceInMonth: coerceFormNumber(raw.priceInMonth),
      allowTo: coerceFormNumber(raw.allowTo),
      countKMExtra: coerceFormNumber(raw.countKMExtra),
      priceHoureExtra: coerceFormNumber(raw.priceHoureExtra),
      priceKmExtra: coerceFormNumber(raw.priceKmExtra),
      otherExpenses: coerceFormNumber(raw.otherExpenses),
      totaltax: coerceFormNumber(raw.totaltax),
      startDate: this.bookingCalendarDateToApi(raw.startDate),
      endDate: this.bookingCalendarDateToApi(raw.endDate),
      dateReturnVehical: this.bookingCalendarDateToApi(raw.dateReturnVehical),
      note: raw.note.trim() || undefined,
      placeUSE: raw.placeUSE.trim() || undefined,
      numberBookingINBasame: raw.numberBookingINBasame.trim() || undefined,
      distancetraveledgps: raw.distancetraveledgps.trim() || undefined,
      totalTrafic: coerceFormNumber(raw.totalTrafic),
      totalMaintance: coerceFormNumber(raw.totalMaintance),
      totalReceivedVehicle: coerceFormNumber(raw.totalReceivedVehicle),
      transportationFees: coerceFormNumber(raw.transportationFees),
      idCountingCustVehicle: ids.idCountingCustVehicle,
      paid: paidForBookingUpdateRequest(coerceFormNumber(raw.paid), this.originalPaidSnapshot()),
      paymentType: raw.paymentType,
      bondType: 1,
      idCash: ids.idCash,
      idBank: ids.idBank,
      paidCash: coerceFormNumber(raw.paidCash),
      paidBank: coerceFormNumber(raw.paidBank),
    };

    this.loading.set(true);
    this.bookingService.update(payload).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Booking updated'));
        this.router.navigate(['/booking']);
      },
      error: err => {
        this.loading.set(false);
        this.toast.error(this.bookingCreateErrorMessage(err));
      },
      complete: () => this.loading.set(false),
    });
  }

  private loadBookingForEdit(): void {
    const bookingId = this.editBookingId();
    const fleetId = this.authState.fleetId() || '';
    if (!bookingId || !fleetId) {
      return;
    }
    this.loading.set(true);
    this.bookingService.getById(String(bookingId), fleetId).subscribe({
      next: booking => this.patchFormFromBooking(booking),
      error: () => this.toast.error(this.translate.instant('Failed to load booking')),
      complete: () => this.loading.set(false),
    });
  }

  private patchFormFromBooking(booking: Booking): void {
    this.originalPaidSnapshot.set(booking.paidtotal ?? booking.paidAmount ?? 0);
    this.editVehicleId.set(this.valueOf(booking.vehicleId));
    this.editVehiclePlate.set(this.valueOf(booking.vehiclePlateNumber));
    this.vehiclePlateLookup.set(this.valueOf(booking.vehiclePlateNumber));
    const customerIqama = this.normalizeNationalId(this.valueOf(booking.customerIqama));
    const patch: Partial<ReturnType<typeof this.form.getRawValue>> = {
      branchId: Number(booking.branchId || this.form.controls.branchId.value),
      customerId: this.valueOf(booking.customerId),
      customerIqama,
      customerNameAr: this.valueOf(booking.customerName),
      customerFirstMobileNumber: this.valueOf(booking.customerMobile),
      customerAddress: this.valueOf(booking.customerAddress),
      customerNationality: this.valueOf(booking.customerNationality),
      customerDrivingLicenseNumber: this.valueOf(booking.customerDrivingLicenseNumber),
      customerDateDrivinglicense: this.toDateInputValue(booking.customerDrivingLicenseExpiry),
      customerBirthDay: this.toDateInputValue(booking.customerBirthDay),
      vehicleId: this.valueOf(booking.vehicleId),
      startDate: this.toDateTimeLocalFromApi(booking.startDate),
      endDate: this.toDateTimeLocalFromApi(booking.endDate),
      dateReturnVehical: this.toDateTimeLocalFromApi(booking.returnDate),
      distancetraveledgps: this.valueOf(booking.distancetraveledgps),
      numberOfHoursExcess: Number(booking.numberOfHoursExcess ?? 0),
      numberKmExcess: Number(booking.numberKmExcess ?? 0),
      dayExcess: Number(booking.dayExcess ?? 0),
      discount: Number(booking.discount ?? 0),
      checkoutCounter: Number(booking.checkoutCounter ?? 0),
      checkinCounter: Number(booking.checkinCounter ?? 0),
      countOfDay: Number(booking.countOfDay ?? 0),
      priceInDay: Number(booking.priceInDay ?? 0),
      priceInMonth: Number(booking.priceInMonth ?? 0),
      allowTo: Number(booking.allowTo ?? 0),
      countKMExtra: Number(booking.countKMExtra ?? 0),
      priceHoureExtra: Number(booking.priceHoureExtra ?? 0),
      priceKmExtra: Number(booking.priceKmExtra ?? 0),
      otherExpenses: Number(booking.otherExpenses ?? 0),
      total: Number(booking.totalAmount ?? 0),
      note: this.valueOf(booking.notes),
      placeUSE: this.valueOf(booking.placeUSE),
      totalTrafic: Number(booking.totalTrafic ?? 0),
      totalMaintance: Number(booking.totalMaintance ?? 0),
      totalReceivedVehicle: Number(booking.totalReceivedVehicle ?? 0),
      transportationFees: Number(booking.transportationFees ?? 0),
      totaltax: Number(booking.totaltax ?? 0),
      paid: Number(booking.paidtotal ?? booking.paidAmount ?? 0),
      numberBookingINBasame: this.valueOf(booking.numberBookingINBasame),
      idCountingCustVehicle: this.valueOf(booking.idCountingCustVehicle),
    };
    this.form.patchValue(patch, { emitEvent: false });
    this.ensureVehicleLoadedForEdit(this.valueOf(booking.vehicleId));
    if (customerIqama) {
      this.customerLookupByIqama(customerIqama);
    }
    this.vehicleCategoryHintsTrigger$.next();
    this.applyPaymentTypeRules(this.form.controls.paymentType.value);
    this.applyAutoTaxFromSettings();
    this.syncBookingTotals();
    this.refreshContractLimitWarnings();
    this.refreshContractBandPriceHints();
    this.loadPaymentSummaryForBooking(Number(booking.id));
  }

  onVehiclePlateLookupChange(value: string): void {
    this.vehiclePlateLookup.set(value ?? '');
  }

  applyVehicleByPlateLookup(): void {
    const plate = this.valueOf(this.vehiclePlateLookup()).toLowerCase();
    if (!plate) {
      return;
    }
    const local = this.vehicles().find(v => this.valueOf(v.plateNumber).toLowerCase() === plate);
    if (local?.id) {
      this.form.patchValue({ vehicleId: String(local.id) }, { emitEvent: true });
      return;
    }
    const fleetId = this.authState.fleetId() || undefined;
    this.vehicleService
      .getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 20,
        search: plate,
        status: 'Available',
      })
      .pipe(catchError(() => of({ items: [] })))
      .subscribe(page => {
        const items = page.items ?? [];
        const found =
          items.find(v => this.valueOf(v.plateNumber).toLowerCase() === plate) ??
          items.find(v => this.valueOf(v.plateNumber).toLowerCase().includes(plate));
        if (!found?.id) {
          return;
        }
        const exists = this.vehicles().some(v => String(v.id) === String(found.id));
        if (!exists) {
          this.vehicles.set([...this.vehicles(), found]);
        }
        this.form.patchValue({ vehicleId: String(found.id) }, { emitEvent: true });
      });
  }

  private ensureVehicleLoadedForEdit(vehicleId: string): void {
    const id = this.valueOf(vehicleId);
    const fleetId = this.authState.fleetId() || '';
    if (!id || !fleetId) {
      return;
    }
    this.vehicleService.getById(id, fleetId).pipe(catchError(() => of(null))).subscribe(vehicle => {
      if (!vehicle) {
        return;
      }
      const current = this.vehicles();
      const index = current.findIndex(v => String(v.id) === String(vehicle.id));
      if (index >= 0) {
        const cloned = [...current];
        cloned[index] = vehicle;
        this.vehicles.set(cloned);
      } else {
        this.vehicles.set([...current, vehicle]);
      }
      this.vehicleCategoryHintsTrigger$.next();
    });
  }

  private loadPaymentSummaryForBooking(idBooking: number): void {
    const fleetId = this.authState.fleetId() ?? '';
    if (!Number.isFinite(idBooking) || idBooking <= 0 || !fleetId) {
      this.paymentRows.set([]);
      this.paymentCountSum.set(null);
      this.lastPayment.set(null);
      this.lastPaymentIsPosting.set(false);
      return;
    }
    this.paymentCountService
      .getLastForBooking(idBooking, fleetId)
      .pipe(
        switchMap(last => {
          this.lastPayment.set(last);
          const fromLast = last?.isPosting === true;
          if (fromLast) {
            this.lastPaymentIsPosting.set(true);
            return of(last);
          }
          return this.paymentCountService.getLastIsPostingForBooking(idBooking, fleetId).pipe(
            map(isPosting => {
              this.lastPaymentIsPosting.set(isPosting);
              return isPosting ? null : last;
            }),
            catchError(() => of(last)),
          );
        }),
        catchError(() => of(null)),
      )
      .subscribe(last => {
        this.lastPayment.set(last);
        const rows = last ? [last] : [];
        this.paymentRows.set(rows);
        const paid = Number(last?.paid);
        this.paymentCountSum.set(Number.isFinite(paid) ? paid : null);
        if (Number.isFinite(paid)) {
          this.form.patchValue({ paid }, { emitEvent: false });
        }
      });
  }

  vouchersTablePaidSum(): number {
    return this.paymentRows().reduce((acc, row) => acc + (Number(row.paid) || 0), 0);
  }

  displayedPaidTotalForEdit(): number {
    if (this.editMode() && this.lastPayment()) {
      return Math.max(0, Number(this.form.controls.paid.value) || 0);
    }
    const fromPaymentCount = this.paymentCountSum();
    if (fromPaymentCount !== null && Number.isFinite(fromPaymentCount)) {
      return fromPaymentCount;
    }
    return Math.max(0, Number(this.form.controls.paid.value) || 0);
  }

  liveLastPaymentRow(): PaymentCount | null {
    const base = this.lastPayment();
    if (!base) {
      return null;
    }
    const paymentType = Number(this.form.controls.paymentType.value);
    const paid = Number(this.form.controls.paid.value);
    const paidCash = Number(this.form.controls.paidCash.value);
    const paidBank = Number(this.form.controls.paidBank.value);
    return {
      ...base,
      paymentType: Number.isFinite(paymentType) ? paymentType : base.paymentType,
      paid: Number.isFinite(paid) ? paid : base.paid,
      paidCash: Number.isFinite(paidCash) ? paidCash : base.paidCash,
      paidBank: Number.isFinite(paidBank) ? paidBank : base.paidBank,
    };
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

  canEditLastVoucherPaid(): boolean {
    return Number(this.lastPayment()?.status) === 1;
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

  dateOrDash(value: string | undefined): string {
    const text = String(value ?? '').trim();
    if (!text) {
      return '-';
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }
    return date.toLocaleString();
  }

  /** `postData` throws `Error` when API returns `succeeded: false` with HTTP 200 (interceptor does not run). */
  private bookingCreateErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      const raw = err.message.replace(/^Booking:\s*/i, '').trim();
      const hinted = this.bookingCreateErrorHint(raw);
      if (hinted) {
        return hinted;
      }
      if (/error occurred while creating the booking/i.test(raw)) {
        return `${raw} — ${this.translate.instant('Booking create server hint after generic')}`;
      }
      return raw || this.translate.instant('Booking create failed');
    }
    return this.translate.instant('Booking create failed');
  }

  /** Frontend-only hints for known backend payment/booking errors. */
  private bookingCreateErrorHint(message: string): string | null {
    const normalized = message.trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    if (normalized.includes('idcash is required')) {
      return 'يجب اختيار الصندوق النقدي لنوع الدفع النقدي';
    }
    if (normalized.includes('current financial year is closed')) {
      return 'السنة المالية الحالية مغلقة ولا يمكن الترحيل';
    }
    if (normalized.includes('revenue account (4101) was not found')) {
      return 'حساب الإيراد 4101 غير موجود في دليل الحسابات';
    }
    return null;
  }

  private isIsoDateExpired(value: string | null | undefined): boolean {
    const iso = value ?? '';
    if (!iso) {
      return false;
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return false;
    }
    return d.getTime() < Date.now();
  }

  private patchCustomerLookup(patch: Record<string, string>, emitEvent = false): void {
    queueMicrotask(() => {
      this.form.patchValue(patch, { emitEvent });
      if (Object.prototype.hasOwnProperty.call(patch, 'customerId')) {
        this.selectedCustomerId.set(String(patch['customerId'] ?? '').trim());
      }
    });
  }

  private customerHasProfile(customer: Customer): boolean {
    return Boolean(
      (customer.nameAr || customer.fullName || customer.firstMobileNumber || customer.phoneNumber || '')
        .trim(),
    );
  }

  private applyExistingCustomerFromLookup(customer: Customer): void {
    if (!this.customers().some(item => String(item.id) === String(customer.id))) {
      this.customers.update(list => [...list, customer]);
    }
    this.patchCustomerLookup({
      customerId: String(customer.id),
      customerNameAr: '',
      customerFirstMobileNumber: '',
      customerAddress: '',
      customerNationality: '',
      customerDrivingLicenseNumber: '',
      customerDateDrivinglicense: '',
      customerBirthDay: '',
    });
  }

  // customerIqamaSuggestionsEnabled(): boolean {
  //   return false;
  // }

  customerLookupByIqama(iqamaInput?: string): void {
    const iqama = this.normalizeNationalId(
      iqamaInput ?? this.form.controls.customerIqama.value.trim(),
    );
    if (!iqama) {
      this.patchCustomerLookup({ customerId: '' });
      return;
    }
    if (iqama.length !== BookingFormComponent.NATIONAL_ID_LENGTH) {
      this.patchCustomerLookup({ customerId: '' });
      return;
    }
    const localMatch = this.customers().find(customer => {
      const candidate = this.normalizeNationalId(
        this.valueOf(customer.idNationality ?? customer.identityNumber),
      );
      return candidate === iqama;
    });
    if (localMatch) {
      this.patchCustomerLookup({ customerId: String(localMatch.id) });
      return;
    }
    const fleetId =
      String(this.form.controls.fleetId.value ?? '').trim() ||
      this.authState.fleetId() ||
      undefined;

    this.customerService
      .getByNationalId(iqama, fleetId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        switchMap(match => {
          if (!match?.id) {
            return of<Customer | null>(null);
          }
          if (this.customerHasProfile(match)) {
            return of(match);
          }
          return this.customerService
            .getById(String(match.id), fleetId)
            .pipe(catchError(() => of(match)));
        }),
      )
      .subscribe({
        next: customer => {
          if (customer) {
            this.applyExistingCustomerFromLookup(customer);
            return;
          }
          // No customer from backend — new customer will be created on save: default license number to national ID.
          const currentSelected = this.selectedCustomer();
          const currentSelectedIqama = currentSelected
            ? this.normalizeAsciiDigits(
                this.valueOf(currentSelected.idNationality ?? currentSelected.identityNumber),
              )
            : '';
          const patch: Record<string, string> = { customerDrivingLicenseNumber: iqama };
          if (currentSelectedIqama !== iqama) {
            patch['customerId'] = '';
          }
          this.patchCustomerLookup(patch);
        },
        error: () => {
          this.toast.error(this.translate.instant('Booking customer lookup failed'));
        },
      });
  }

  onCustomerIqamaPaste(event: ClipboardEvent): void {
    const pastedText = event.clipboardData?.getData('text') ?? '';
    const iqama = this.normalizeNationalId(pastedText);
    if (!iqama) {
      return;
    }
    this.form.patchValue({ customerIqama: iqama }, { emitEvent: true });
    this.customerLookupByIqama(iqama);
  }

  onNationalityFocus(): void {
    this.nationalitySuggestionsOpen.set(true);
    this.refreshNationalitySuggestionList();
  }

  onNationalityInput(): void {
    this.nationalitySuggestionsOpen.set(true);
    this.refreshNationalitySuggestionList();
  }

  onNationalityBlur(): void {
    window.setTimeout(() => {
      this.nationalitySuggestionsOpen.set(false);
    }, 180);
  }

  pickNationalitySuggestion(event: Event, suggestion: BookingNationalitySuggestion): void {
    event.preventDefault();
    this.form.controls.customerNationality.patchValue(suggestion.canonicalValue, { emitEvent: true });
    this.nationalitySuggestionsOpen.set(false);
    this.nationalitySuggestions.set([]);
  }

  // onCustomerIqamaKeydown(event: KeyboardEvent): void {
  //   const suggestions = this.customerIqamaSuggestions();
  //   if (suggestions.length === 0) {
  //     return;
  //   }
  //   if (event.key === 'ArrowDown') {
  //     event.preventDefault();
  //     const next = (this.activeCustomerSuggestionIndex() + 1) % suggestions.length;
  //     this.activeCustomerSuggestionIndex.set(next);
  //     return;
  //   }
  //   if (event.key === 'ArrowUp') {
  //     event.preventDefault();
  //     const next =
  //       (this.activeCustomerSuggestionIndex() - 1 + suggestions.length) % suggestions.length;
  //     this.activeCustomerSuggestionIndex.set(next);
  //     return;
  //   }
  //   if (event.key === 'Enter') {
  //     const idx = this.activeCustomerSuggestionIndex();
  //     if (idx >= 0 && idx < suggestions.length) {
  //       event.preventDefault();
  //       this.pickCustomerSuggestion(suggestions[idx]);
  //     }
  //     return;
  //   }
  //   if (event.key === 'Escape') {
  //     this.customerIqamaSuggestions.set([]);
  //     this.activeCustomerSuggestionIndex.set(-1);
  //   }
  // }

  // hideCustomerSuggestions(): void {
  //   setTimeout(() => {
  //     this.customerIqamaSuggestions.set([]);
  //     this.activeCustomerSuggestionIndex.set(-1);
  //   }, 120);
  // }

  // setActiveCustomerSuggestion(index: number): void {
  //   this.activeCustomerSuggestionIndex.set(index);
  // }

  // pickCustomerSuggestion(customer: Customer): void {
  //   const iqama = this.normalizeNationalId(this.valueOf(customer.idNationality ?? customer.identityNumber));
  //   const exists = this.customers().some(item => String(item.id) === String(customer.id));
  //   if (!exists) {
  //     this.customers.set([...this.customers(), customer]);
  //   }
  //   this.form.patchValue(
  //     {
  //       customerIqama: iqama,
  //       customerId: String(customer.id),
  //       customerNameAr: '',
  //       customerFirstMobileNumber: '',
  //       customerAddress: '',
  //       customerNationality: '',
  //       customerDrivingLicenseNumber: '',
  //       customerDateDrivinglicense: '',
  //       customerBirthDay: '',
  //     },
  //     { emitEvent: false },
  //   );
  //   this.customerIqamaSuggestions.set([]);
  //   this.activeCustomerSuggestionIndex.set(-1);
  // }

  // customerSuggestionLabel(customer: Customer): string {
  //   const iqama = this.valueOf(customer.idNationality ?? customer.identityNumber) || '-';
  //   const name = this.valueOf(customer.nameAr ?? customer.fullName ?? customer.nameEn) || '-';
  //   return `${iqama} - ${name}`;
  // }

  // customerSuggestionIqamaParts(customer: Customer): {
  //   before: string;
  //   match: string;
  //   after: string;
  //   name: string;
  // } {
  //   const iqamaRaw = this.valueOf(customer.idNationality ?? customer.identityNumber) || '-';
  //   const name = this.valueOf(customer.nameAr ?? customer.fullName ?? customer.nameEn) || '-';
  //   const query = this.normalizeNationalId(this.form.controls.customerIqama.value.trim());
  //   if (!query || iqamaRaw === '-') {
  //     return { before: iqamaRaw, match: '', after: '', name };
  //   }
  //   const iqamaNormalized = this.normalizeNationalId(iqamaRaw);
  //   const idx = iqamaNormalized.indexOf(query);
  //   if (idx < 0) {
  //     return { before: iqamaRaw, match: '', after: '', name };
  //   }
  //   return {
  //     before: iqamaRaw.slice(0, idx),
  //     match: iqamaRaw.slice(idx, idx + query.length),
  //     after: iqamaRaw.slice(idx + query.length),
  //     name,
  //   };
  // }

  customerContractNumber(): string {
    return this.valueOf(this.form.controls.numberBookingINBasame.value);
  }

  selectedVehicle(): Vehicle | null {
    const vehicleId = this.form.controls.vehicleId.value;
    if (!vehicleId) {
      return null;
    }
    return this.vehicles().find(vehicle => String(vehicle.id) === String(vehicleId)) ?? null;
  }

  customerBasicFieldValue(label: string): string {
    const customer = this.selectedCustomer();
    if (!customer) {
      return '-';
    }
    const field = this.customerBasicFields.find(item => item.label === label);
    if (!field) {
      return '-';
    }
    return field.resolver(customer) || '-';
  }

  missingCustomerBasicFields(): string[] {
    return this.getMissingCustomerBasicFields(this.selectedCustomer());
  }

  private getMissingCustomerBasicFields(customer: Customer | null): string[] {
    if (!customer) {
      const raw = this.form.getRawValue();
      const missing: string[] = [];
      if (!this.valueOf(raw.customerIqama)) {
        missing.push(this.translate.instant('Identity Number'));
      }
      if (!this.valueOf(raw.customerNameAr)) {
        missing.push(this.translate.instant('Arabic Name'));
      }
      if (!this.valueOf(raw.customerFirstMobileNumber)) {
        missing.push(this.translate.instant('Primary Mobile Number'));
      }
      if (!this.valueOf(raw.customerNationality)) {
        missing.push(this.translate.instant('Nationality'));
      }
      if (!this.bookingCalendarDateToApi(raw.customerDateDrivinglicense)) {
        missing.push(this.translate.instant('Driving License Expiry Date'));
      }
      if (!this.bookingCalendarDateToApi(raw.customerBirthDay)) {
        missing.push(this.translate.instant('Date of Birth'));
      }
      return missing;
    }

    const missing = this.customerBasicFields
      .filter(field => {
        if (field.isComplete) {
          return !field.isComplete(customer);
        }
        return !field.resolver(customer);
      })
      .map(field => this.translate.instant(field.label));

    if (!this.customerContractNumber()) {
      missing.push(this.translate.instant('Rental Contract Number'));
    }

    return missing;
  }

  categoryDisplayName(cat: CategoryVehicle): string {
    return (cat.nameAr || cat.nameEn || '').trim() || '-';
  }

  formatMoney(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) {
      return '—';
    }
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
  }

  formatRange(low?: number | null, high?: number | null): string {
    const lo = typeof low === 'number' && Number.isFinite(low) ? low : null;
    const hi = typeof high === 'number' && Number.isFinite(high) ? high : null;
    if (lo !== null && hi !== null) {
      return `${this.formatMoney(lo)} – ${this.formatMoney(hi)}`;
    }
    if (lo !== null) {
      return this.formatMoney(lo);
    }
    if (hi !== null) {
      return this.formatMoney(hi);
    }
    return '—';
  }

  formatIntRange(low?: number | null, high?: number | null): string {
    const lo = typeof low === 'number' && Number.isFinite(low) ? Math.round(low) : null;
    const hi = typeof high === 'number' && Number.isFinite(high) ? Math.round(high) : null;
    if (lo !== null && hi !== null) {
      return `${lo} – ${hi}`;
    }
    if (lo !== null) {
      return String(lo);
    }
    if (hi !== null) {
      return String(hi);
    }
    return '—';
  }

  /** True when the category defines an extra-km price band (for hints under Extra KM Price). */
  categoryKmPriceBandDefined(cat: CategoryVehicle): boolean {
    const lo = this.categoryKmPriceLow(cat);
    const hi = this.categoryKmPriceHigh(cat);
    return (
      (typeof lo === 'number' && Number.isFinite(lo) && lo > 0) ||
      (typeof hi === 'number' && Number.isFinite(hi) && hi > 0)
    );
  }

  /**
   * Extra-km **price** low from category: prefer `priceKmExtraLow`, else `countKMExtraLow`
   * (API / forms use the count* keys for this price band — see category vehicle form).
   */
  private categoryKmPriceLow(cat?: CategoryVehicle): number | undefined {
    if (!cat) {
      return undefined;
    }
    if (typeof cat.priceKmExtraLow === 'number' && Number.isFinite(cat.priceKmExtraLow)) {
      return cat.priceKmExtraLow;
    }
    if (typeof cat.countKMExtraLow === 'number' && Number.isFinite(cat.countKMExtraLow)) {
      return cat.countKMExtraLow;
    }
    return undefined;
  }

  private categoryKmPriceHigh(cat?: CategoryVehicle): number | undefined {
    if (!cat) {
      return undefined;
    }
    if (typeof cat.priceKmExtraHigh === 'number' && Number.isFinite(cat.priceKmExtraHigh)) {
      return cat.priceKmExtraHigh;
    }
    if (typeof cat.countKMExtraHigh === 'number' && Number.isFinite(cat.countKMExtraHigh)) {
      return cat.countKMExtraHigh;
    }
    return undefined;
  }

  suggestedRentalSubtotal(): number {
    const r = this.form.getRawValue();
    const days = Math.max(0, Number(r.countOfDay) || 0);
    const daily = Math.max(0, Number(r.priceInDay) || 0);
    const discount = Math.max(0, Number(r.discount) || 0);
    return Math.max(0, Math.round((days * daily - discount) * 100) / 100);
  }

  suggestedContractTotal(): number {
    const r = this.form.getRawValue();
    const base = this.suggestedRentalSubtotal();
    const add =
      Math.max(0, Number(r.otherExpenses) || 0) +
      Math.max(0, Number(r.totaltax) || 0) +
      Math.max(0, Number(r.transportationFees) || 0);
    return Math.max(0, Math.round((base + add) * 100) / 100);
  }

  applySuggestedTotal(): void {
    this.form.patchValue({ total: this.suggestedContractTotal() }, { emitEvent: false });
  }

  expectedAmount(): number {
    const r = this.form.getRawValue();
    const days = Math.max(0, Number(r.countOfDay) || 0);
    const daily = Math.max(0, Number(r.priceInDay) || 0);
    return Math.round(days * daily * 100) / 100;
  }

  amountAfterTaxAndDiscount(): number {
    const r = this.form.getRawValue();
    const expected = this.expectedAmount();
    const discountInput = Math.max(0, Number(r.discount) || 0);
    const discountType = r.discountType;
    const tax = Math.max(0, Number(r.totaltax) || 0);
    const discountValue =
      discountType === 'percent'
        ? Math.round(expected * Math.min(100, discountInput) * 100) / 10000
        : discountInput;
    return Math.max(0, Math.round((expected - discountValue + tax) * 100) / 100);
  }

  discountAppliedValue(): number {
    const r = this.form.getRawValue();
    const expected = this.expectedAmount();
    const discountInput = Math.max(0, Number(r.discount) || 0);
    if (r.discountType === 'percent') {
      return Math.round(expected * Math.min(100, discountInput) * 100) / 10000;
    }
    return Math.min(expected, discountInput);
  }

  remainingAmount(): number {
    const net = this.amountAfterTaxAndDiscount();
    const paid = Math.max(0, Number(this.form.controls.paid.value) || 0);
    return Math.max(0, Math.round((net - paid) * 100) / 100);
  }

  overpaidAmount(): number {
    const net = this.amountAfterTaxAndDiscount();
    const paid = Math.max(0, Number(this.form.controls.paid.value) || 0);
    return Math.max(0, Math.round((paid - net) * 100) / 100);
  }

  private syncBookingTotals(): void {
    this.form.patchValue({ total: this.amountAfterTaxAndDiscount() }, { emitEvent: false });
  }

  /** Sync hidden numerics, contract dates, and totals immediately before validation/submit. */
  private prepareFormBeforeSave(): void {
    this.seedHiddenNumericDefaults();
    this.syncDatesFromStartAndDays();
    this.applyAutoTaxFromSettings();
    this.syncBookingTotals();
  }

  private seedHiddenNumericDefaults(): void {
    const patch: Record<string, number> = {};
    for (const key of BookingFormComponent.HIDDEN_NUMERIC_DEFAULT_KEYS) {
      const ctrl = this.form.get(key);
      if (ctrl && isEmptyNumericValue(ctrl.value)) {
        patch[key] = 0;
      }
    }
    if (Object.keys(patch).length > 0) {
      this.form.patchValue(patch, { emitEvent: false });
    }
  }

  private firstInvalidControlLabel(): string | null {
    for (const [name, ctrl] of Object.entries(this.form.controls)) {
      if (!ctrl.invalid) {
        continue;
      }
      const labelKey = BookingFormComponent.FORM_CONTROL_LABEL_KEYS[name];
      return labelKey ? this.translate.instant(labelKey) : name;
    }
    return null;
  }

  private applyAutoTaxFromSettings(): void {
    const settings = this.bookingSettings();
    if (!settings || settings.id <= 0) {
      return;
    }
    const rate = Math.max(0, Number(settings.tax) || 0);
    const taxableBase = Math.max(0, this.expectedAmount() - this.discountAppliedValue());
    const taxValue = Math.round(((taxableBase * rate) / 100) * 100) / 100;
    this.form.patchValue({ totaltax: taxValue }, { emitEvent: false });
  }

  private refreshContractLimitWarnings(): void {
    this.contractLimitWarnings.set(this.buildContractLimitWarnings());
  }

  minimumPaidAtCreateWarning(): string | null {
    const settings = this.bookingSettings();
    if (!settings || settings.id <= 0) {
      return null;
    }
    const minPaidAtBooking = Math.max(0, Number(settings.minValue) || 0);
    const paidAtBooking = Math.max(0, Number(this.form.controls.paid.value) || 0);
    if (paidAtBooking >= minPaidAtBooking) {
      return null;
    }
    return this.translate.instant('Booking minimum paid at create not met', {
      min: minPaidAtBooking,
      paid: paidAtBooking,
    });
  }

  private buildContractLimitWarnings(): string[] {
    const settings = this.bookingSettings();
    if (!settings || settings.id <= 0) {
      return [];
    }
    const raw = this.form.getRawValue();
    const warnings: string[] = [];
    const lateHours = Math.max(0, Number(raw.numberOfHoursExcess) || 0);
    const lateHoursLimit = Math.max(0, Number(settings.number_hour_latefree) || 0);
    if (lateHours > lateHoursLimit) {
      warnings.push(
        this.translate.instant('Booking contract limit free late hours exceeded', {
          current: lateHours,
          allowed: lateHoursLimit,
        }),
      );
    }

    const latePerDay = Math.max(0, Number(raw.dayExcess) || 0);
    const latePerDayLimit = Math.max(0, Number(settings.number_hour_late_forr_finshinday) || 0);
    if (latePerDay > latePerDayLimit) {
      warnings.push(
        this.translate.instant('Booking contract limit late per day exceeded', {
          current: latePerDay,
          allowed: latePerDayLimit,
        }),
      );
    }

    const extraKm = Math.max(0, Number(raw.numberKmExcess) || 0);
    const extraKmLimit = Math.max(0, Number(settings.number_incres_km_for_finshcontract) || 0);
    if (extraKm > extraKmLimit) {
      warnings.push(
        this.translate.instant('Booking contract limit extra km exceeded', {
          current: extraKm,
          allowed: extraKmLimit,
        }),
      );
    }
    return warnings;
  }

  private refreshContractBandPriceHints(): void {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    this.contractPriceBandHintDaily.set(
      this.buildContractBandPriceHintMessage(
        raw,
        'priceInDay',
        'priceDayBandLow',
        'priceDayBandHigh',
        'Booking contract price band hint daily',
      ),
    );
    this.contractPriceBandHintHour.set(
      this.buildContractBandPriceHintMessage(
        raw,
        'priceHoureExtra',
        'priceHourExtraBandLow',
        'priceHourExtraBandHigh',
        'Booking contract price band hint hour',
      ),
    );
    this.contractPriceBandHintKm.set(
      this.buildContractBandPriceHintMessage(
        raw,
        'priceKmExtra',
        'priceKmExtraBandLow',
        'priceKmExtraBandHigh',
        'Booking contract price band hint km',
      ),
    );
  }

  private buildContractBandPriceHintMessage(
    raw: Record<string, unknown>,
    valueKey: string,
    lowKey: string,
    highKey: string,
    translateKey: string,
  ): string | null {
    const lo = Math.max(0, Number(raw[lowKey]) || 0);
    const hi = Math.max(0, Number(raw[highKey]) || 0);
    const hasLo = lo > 0;
    const hasHi = hi > 0;
    if (!hasLo && !hasHi) {
      return null;
    }
    const minB = hasLo && hasHi ? Math.min(lo, hi) : hasLo ? lo : hi;
    const maxB = hasLo && hasHi ? Math.max(lo, hi) : hasLo ? lo : hi;
    const parsed = this.parseOptionalFiniteNumber(raw[valueKey]);
    if (parsed === null) {
      return null;
    }
    if (parsed >= minB && parsed <= maxB) {
      return null;
    }
    return this.translate.instant(translateKey, {
      current: this.formatContractBandHintNumber(parsed),
      min: this.formatContractBandHintNumber(minB),
      max: this.formatContractBandHintNumber(maxB),
    });
  }

  private parseOptionalFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    const n = typeof value === 'number' ? value : Number(value);
    if (!Number.isFinite(n)) {
      return null;
    }
    return n;
  }

  private formatContractBandHintNumber(n: number): string {
    const r = Math.round(n * 100) / 100;
    if (Math.abs(r - Math.round(r)) < 1e-9) {
      return String(Math.round(r));
    }
    return r.toFixed(2);
  }

  vehicleInfoValue(
    field:
      | 'branch'
      | 'type'
      | 'serialNumber'
      | 'engine'
      | 'year'
      | 'plateNumber'
      | 'vin'
      | 'color'
      | 'insuranceNumber'
      | 'insuranceType'
      | 'insuranceExpires'
      | 'licenseExpirationDate'
      | 'insurancePolicyNumber'
      | 'operatinCard'
      | 'validityCarRegistration'
      | 'mileage'
      | 'seats',
  ): string {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return '-';
    }

    if (field === 'branch') return this.valueOf(vehicle.branchName) || '-';
    if (field === 'type') return this.valueOf(vehicle.categoryName ?? vehicle.make) || '-';
    if (field === 'serialNumber') return this.valueOf(vehicle.serialNumber) || '-';
    if (field === 'engine') return this.valueOf(vehicle.engine) || '-';
    if (field === 'year') return vehicle.year ? String(vehicle.year) : '-';
    if (field === 'plateNumber') return this.valueOf(vehicle.plateNumber) || '-';
    if (field === 'vin') return this.valueOf(vehicle.vin) || '-';
    if (field === 'color') return this.valueOf(vehicle.color) || '-';
    if (field === 'insuranceNumber') return this.valueOf(vehicle.insuranceNumber) || '-';
    if (field === 'insuranceType')
      return vehicle.insuranceType != null ? String(vehicle.insuranceType) : '-';
    if (field === 'insuranceExpires') return this.formatVehicleDateValue(vehicle.insuranceExpires);
    if (field === 'licenseExpirationDate')
      return this.formatVehicleDateValue(vehicle.licenseExpirationDate);
    if (field === 'insurancePolicyNumber')
      return this.valueOf(vehicle.insurancePolicyNumber) || '-';
    if (field === 'operatinCard') return this.formatVehicleDateValue(vehicle.operatinCard);
    if (field === 'validityCarRegistration')
      return this.formatVehicleDateValue(vehicle.validityCarRegistration);
    if (field === 'mileage') return String(vehicle.countKm ?? vehicle.mileage ?? '-');
    if (field === 'seats') return String(vehicle.capacitOil ?? vehicle.seats ?? '-');
    return '-';
  }

  private formatVehicleDateValue(value: string | undefined): string {
    const text = this.valueOf(value);
    if (!text) {
      return '-';
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return text;
    }
    return date.toLocaleDateString();
  }

  private loadCategoryForSelectedVehicle$(): Observable<{
    vehicle: Vehicle | null;
    cat: CategoryVehicle | null;
  }> {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return of({ vehicle: null, cat: null });
    }

    const fromList = this.resolveCategoryForVehicle(vehicle);
    const catId = this.resolveCategoryIdFromVehicle(vehicle);
    const fleetId =
      String(this.form.controls.fleetId.value ?? '').trim() ||
      this.authState.fleetId() ||
      undefined;

    if (!catId || !fleetId) {
      return of({ vehicle, cat: fromList ?? null });
    }

    /** List rows are often partial — always load details so pricing bands populate. */
    return this.categoryVehicleService.getById(catId, fleetId).pipe(
      catchError(() => of(null)),
      map(fetched => ({
        vehicle,
        cat: this.mergeCategoryDetailForBooking(fromList, fetched),
      })),
    );
  }

  private mergeCategoryDetailForBooking(
    fromList: CategoryVehicle | undefined,
    fetched: CategoryVehicle | null,
  ): CategoryVehicle | null {
    if (fetched && fromList) {
      return { ...fromList, ...fetched };
    }
    return fetched ?? fromList ?? null;
  }

  /** Apply min / mid / max of the current band to the matching contract line. */
  applyBandPreset(target: 'day' | 'hour' | 'km', preset: 'min' | 'mid' | 'max'): void {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    if (target === 'day') {
      const lo = Math.max(0, Number(raw['priceDayBandLow']) || 0);
      const hi = Math.max(0, Number(raw['priceDayBandHigh']) || 0);
      const v = this.bandPresetValue(lo, hi, preset);
      if (v === undefined) {
        return;
      }
      this.form.patchValue({ priceInDay: v }, { emitEvent: true });
      return;
    }
    if (target === 'hour') {
      const lo = Math.max(0, Number(raw['priceHourExtraBandLow']) || 0);
      const hi = Math.max(0, Number(raw['priceHourExtraBandHigh']) || 0);
      const v = this.bandPresetValue(lo, hi, preset);
      if (v === undefined) {
        return;
      }
      this.form.patchValue({ priceHoureExtra: v }, { emitEvent: true });
      return;
    }
    const lo = Math.max(0, Number(raw['priceKmExtraBandLow']) || 0);
    const hi = Math.max(0, Number(raw['priceKmExtraBandHigh']) || 0);
    const v = this.bandPresetValue(lo, hi, preset);
    if (v === undefined) {
      return;
    }
    this.form.patchValue({ priceKmExtra: v }, { emitEvent: true });
  }

  private bandPresetValue(
    lo: number,
    hi: number,
    preset: 'min' | 'mid' | 'max',
  ): number | undefined {
    const a = Math.max(0, lo);
    const b = Math.max(0, hi);
    if (a <= 0 && b <= 0) {
      return undefined;
    }
    if (a <= 0) {
      return Math.round(b * 100) / 100;
    }
    if (b <= 0) {
      return Math.round(a * 100) / 100;
    }
    const low = Math.min(a, b);
    const high = Math.max(a, b);
    if (preset === 'min') {
      return low;
    }
    if (preset === 'max') {
      return high;
    }
    return Math.round(((low + high) / 2) * 100) / 100;
  }

  private patchFormFromVehicleAndCategory(vehicle: Vehicle, cat?: CategoryVehicle): void {
    const raw = this.form.getRawValue();

    const suggestedDaily = this.resolveSuggestedDailyRate(vehicle, cat);
    const suggestedMonthly = this.resolveSuggestedMonthlyRate(vehicle, cat);
    const suggestedHourExtra = this.higherBandValue(
      cat?.priceHoureExtraLow,
      cat?.priceHoureExtraHigh,
    );
    const suggestedKmExtra = this.higherBandValue(
      this.categoryKmPriceLow(cat),
      this.categoryKmPriceHigh(cat),
    );

    let priceDayBandLow = 0;
    let priceDayBandHigh = 0;
    let priceHourExtraBandLow = 0;
    let priceHourExtraBandHigh = 0;
    let priceKmExtraBandLow = 0;
    let priceKmExtraBandHigh = 0;
    if (cat) {
      priceDayBandLow = Math.max(0, Number(cat.price_day_low) || 0);
      priceDayBandHigh = Math.max(0, Number(cat.price_day_high) || 0);
      priceHourExtraBandLow = Math.max(0, Number(cat.priceHoureExtraLow) || 0);
      priceHourExtraBandHigh = Math.max(0, Number(cat.priceHoureExtraHigh) || 0);
      priceKmExtraBandLow = Math.max(0, this.categoryKmPriceLow(cat) ?? 0);
      priceKmExtraBandHigh = Math.max(0, this.categoryKmPriceHigh(cat) ?? 0);
    }

    const branchId = vehicle.branchId && vehicle.branchId > 0 ? vehicle.branchId : raw.branchId;
    const checkoutCounter = this.pickNumeric(raw.checkoutCounter, vehicle.mileage);
    const priceInDay =
      suggestedDaily > 0 ? suggestedDaily : this.pickNumeric(raw.priceInDay, vehicle.dailyRate);
    const priceInMonth =
      suggestedMonthly > 0
        ? suggestedMonthly
        : this.pickNumeric(raw.priceInMonth, vehicle.monthlyRate);

    let allowTo = raw.allowTo;
    let countKMExtra = raw.countKMExtra;
    let priceHoureExtra = raw.priceHoureExtra;
    let priceKmExtra = raw.priceKmExtra;
    if (cat) {
      const allow = cat.allowToLow;
      if (typeof allow === 'number' && Number.isFinite(allow)) {
        allowTo = allow;
      }
      const kmExtra = cat.countKMExtraLow;
      if (typeof kmExtra === 'number' && Number.isFinite(kmExtra)) {
        countKMExtra = kmExtra;
      }
      if (suggestedHourExtra > 0) {
        priceHoureExtra = suggestedHourExtra;
      }
      if (suggestedKmExtra > 0) {
        priceKmExtra = suggestedKmExtra;
      }
    }

    this.form.patchValue(
      {
        branchId,
        checkoutCounter,
        priceInDay,
        priceInMonth,
        allowTo,
        countKMExtra,
        priceHoureExtra,
        priceKmExtra,
        priceDayBandLow,
        priceDayBandHigh,
        priceHourExtraBandLow,
        priceHourExtraBandHigh,
        priceKmExtraBandLow,
        priceKmExtraBandHigh,
      },
      { emitEvent: false },
    );
    this.normalizeBandPair('priceDayBandLow', 'priceDayBandHigh');
    this.normalizeBandPair('priceHourExtraBandLow', 'priceHourExtraBandHigh');
    this.normalizeBandPair('priceKmExtraBandLow', 'priceKmExtraBandHigh');
    this.refreshContractBandPriceHints();
    this.syncDatesFromStartAndDays();
  }

  /** Prefer GUID/string id; fall back to numeric category id when `categoryVehicleId` is empty. */
  private resolveCategoryIdFromVehicle(vehicle: Vehicle): string | null {
    const guid = (vehicle.categoryVehicleId ?? '').trim();
    if (guid) {
      return guid;
    }
    if (vehicle.idCategoryVehicle != null && String(vehicle.idCategoryVehicle).trim() !== '') {
      return String(vehicle.idCategoryVehicle);
    }
    return null;
  }

  private resolveCategoryForVehicle(vehicle: Vehicle): CategoryVehicle | undefined {
    const categories = this.categories();
    const categoryId = this.resolveCategoryIdFromVehicle(vehicle);
    if (categoryId) {
      const byId = categories.find(c => String(c.id) === categoryId);
      if (byId) {
        return byId;
      }
    }

    const categoryName = (vehicle.categoryName ?? '').trim().toLowerCase();
    if (!categoryName) {
      return undefined;
    }

    return categories.find(c => {
      const nameAr = (c.nameAr ?? '').trim().toLowerCase();
      const nameEn = (c.nameEn ?? '').trim().toLowerCase();
      return nameAr === categoryName || nameEn === categoryName;
    });
  }

  private resolveSuggestedDailyRate(vehicle: Vehicle, cat?: CategoryVehicle): number {
    const direct = vehicle.dailyRate;
    if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) {
      return direct;
    }
    const fromBand = this.higherBandValue(cat?.price_day_low, cat?.price_day_high);
    if (fromBand > 0) {
      return fromBand;
    }
    const low = cat?.price_day_low;
    if (typeof low === 'number' && Number.isFinite(low) && low > 0) {
      return low;
    }
    return 0;
  }

  private resolveSuggestedMonthlyRate(vehicle: Vehicle, cat?: CategoryVehicle): number {
    const direct = vehicle.monthlyRate;
    if (typeof direct === 'number' && Number.isFinite(direct) && direct > 0) {
      return direct;
    }
    const mid = this.midpointOrFirst(cat?.price_month_low, cat?.price_month_high);
    if (typeof mid === 'number' && mid > 0) {
      return Math.round(mid * 100) / 100;
    }
    const low = cat?.price_month_low;
    if (typeof low === 'number' && Number.isFinite(low) && low > 0) {
      return low;
    }
    return 0;
  }

  private midpointOrFirst(low?: number | null, high?: number | null): number | undefined {
    const a = typeof low === 'number' && Number.isFinite(low) ? low : undefined;
    const b = typeof high === 'number' && Number.isFinite(high) ? high : undefined;
    if (a !== undefined && b !== undefined) {
      return Math.round(((a + b) / 2) * 100) / 100;
    }
    return a ?? b;
  }

  /** Upper bound of a numeric band (defaults contract lines to the category maximum). */
  private higherBandValue(low?: number | null, high?: number | null): number {
    const a = typeof low === 'number' && Number.isFinite(low) ? low : 0;
    const b = typeof high === 'number' && Number.isFinite(high) ? high : 0;
    return Math.round(Math.max(a, b, 0) * 100) / 100;
  }

  private normalizeBandPair(lowKey: string, highKey: string): void {
    const raw = this.form.getRawValue() as Record<string, unknown>;
    const lo = Math.max(0, Number(raw[lowKey]) || 0);
    const hi = Math.max(0, Number(raw[highKey]) || 0);
    const low = Math.min(lo, hi);
    const high = Math.max(lo, hi);
    if (lo !== low || hi !== high) {
      this.form.patchValue({ [lowKey]: low, [highKey]: high } as Record<string, number>, {
        emitEvent: false,
      });
    }
  }

  /** Auto-calculate end/return dates from start date and number of days. */
  private syncDatesFromStartAndDays(): void {
    const start = this.form.controls.startDate.value?.trim();
    const daysRaw = Number(this.form.controls.countOfDay.value ?? 0);
    const days = Math.max(0, Number.isFinite(daysRaw) ? Math.floor(daysRaw) : 0);
    if (!start || days <= 0) {
      return;
    }
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) {
      return;
    }
    const endDate = new Date(startDate);
    // Day-based rental follows 24-hour periods: +N days from start date.
    endDate.setDate(endDate.getDate() + days);
    const computed = this.toDateTimeLocalValue(endDate);
    if (!computed) {
      return;
    }
    this.form.patchValue({ endDate: computed, dateReturnVehical: computed }, { emitEvent: false });
  }

  private pickNumeric(currentValue: number | null, incoming: number | null | undefined): number {
    if (!isEmptyNumericValue(currentValue) && Number.isFinite(Number(currentValue))) {
      return Number(currentValue);
    }
    if (typeof incoming === 'number' && Number.isFinite(incoming)) {
      return incoming;
    }
    return 0;
  }

  private valueOf(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    return String(value).trim();
  }

  /** Eastern Arabic-Indic digits → ASCII (helps ids/phones if copied from RTL UI). */
  private normalizeAsciiDigits(value: string): string {
    const map: Record<string, string> = {
      '٠': '0',
      '١': '1',
      '٢': '2',
      '٣': '3',
      '٤': '4',
      '٥': '5',
      '٦': '6',
      '٧': '7',
      '٨': '8',
      '٩': '9',
    };
    return value.replace(/[٠-٩]/g, ch => map[ch] ?? ch);
  }

  /** Normalize national id to ASCII digits only (max 10). */
  private normalizeNationalId(value: string): string {
    return this.normalizeAsciiDigits(value)
      .replace(/\D/g, '')
      .slice(0, BookingFormComponent.NATIONAL_ID_LENGTH);
  }

  /**
   * Gregorian/ISO expiry for `DateDrivinglicense` on create. Hijri-only profiles are incomplete
   * even if `dateDrivinglicenseHajri` is filled (UI may still show Hijri via `resolver`).
   */
  private drivingLicenseDateForBookingApi(customer: Customer): {
    api: string;
    hijriPrimaryBlocked: boolean;
    needGregorianHint: boolean;
  } {
    const c = customer;
    const licPrimary = this.normalizeAsciiDigits(this.valueOf(c.dateDrivinglicense));
    if (this.isLikelyHijriDateInput(licPrimary)) {
      return { api: '', hijriPrimaryBlocked: true, needGregorianHint: false };
    }
    const drivingLicenseIso =
      this.isoOrRaw(c.dateDrivinglicense) || this.isoOrRaw(c.drivingLicenseExpiryDate);
    const api = this.customerDateFieldToApi(
      drivingLicenseIso || licPrimary || this.valueOf(c.drivingLicenseExpiryDate),
    );
    if (!api) {
      const licHajri = this.normalizeAsciiDigits(this.valueOf(c.dateDrivinglicenseHajri));
      const needGregorian =
        !licPrimary && Boolean(this.valueOf(c.dateDrivinglicenseHajri) || licHajri);
      return { api: '', hijriPrimaryBlocked: false, needGregorianHint: needGregorian };
    }
    return { api, hijriPrimaryBlocked: false, needGregorianHint: false };
  }

  /**
   * Backend `BirthDay` is non-nullable `DateTime` — omitting or sending an unparseable value can break create/history.
   */
  private resolveCustomerBirthForBookingApi(customer: Customer): string {
    const c = customer;
    const iso = this.isoOrRaw(c.birthDay) || this.isoOrRaw(c.dateOfBirth);
    if (iso) {
      const api = this.customerDateFieldToApi(iso);
      if (api) {
        return api;
      }
    }
    const raw = this.normalizeAsciiDigits(this.valueOf(c.birthDay ?? c.dateOfBirth));
    if (!raw) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
      return this.customerDateFieldToApi(raw) || '';
    }
    return this.customerDateFieldToApi(raw) || '';
  }

  private isLikelyHijriDateInput(value: string): boolean {
    const s = this.normalizeAsciiDigits(value).trim();
    if (!s) {
      return false;
    }
    if (/^14[4-7]\d[./-]\d{1,2}[./-]\d{1,2}$/.test(s)) {
      return true;
    }
    if (/^\d{1,2}[./-]\d{1,2}[./-]14[4-7]\d$/.test(s)) {
      return true;
    }
    return false;
  }

  private parseFormNumber(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    const s = this.normalizeAsciiDigits(String(value ?? '').trim());
    if (!s) {
      return NaN;
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }

  private isGuid(value: string): boolean {
    const normalized = value.trim().replace(/^\{|\}$/g, '');
    return /^[0-9a-fA-F]{8}(-?[0-9a-fA-F]{4}){3}-?[0-9a-fA-F]{12}$/.test(normalized);
  }

  /** Normalize GUID text for API binder; returns undefined for empty/invalid values. */
  private normalizeGuidOrUndefined(value: string): string | undefined {
    const normalized = value.trim().replace(/^\{|\}$/g, '');
    if (!normalized) {
      return undefined;
    }
    return this.isGuid(normalized) ? normalized : undefined;
  }

  private applyDefaultCustomerVehicleCounting(): void {
    const current = this.normalizeGuidOrUndefined(
      String(this.form.controls.idCountingCustVehicle.value ?? '').trim(),
    );
    if (current) {
      return;
    }
    const fallback = this.defaultCustomerVehicleCountingId();
    if (!fallback) {
      return;
    }
    this.form.patchValue({ idCountingCustVehicle: fallback }, { emitEvent: false });
  }

  private defaultCustomerVehicleCountingId(): string | undefined {
    const byNumber = this.countingEntries().find(
      entry =>
        Number(entry.countingNumber) ===
        BookingFormComponent.DEFAULT_CUSTOMER_VEHICLE_COUNTING_NUMBER,
    );
    const fallback = byNumber ?? this.countingEntries().find(entry => Boolean(entry.id));
    return fallback?.id ? String(fallback.id).trim() : undefined;
  }

  // private customerIqamaSuggestions$(iqama: string): Observable<Customer[]> {
  //   if (!iqama || iqama.length >= BookingFormComponent.NATIONAL_ID_LENGTH) {
  //     return of([]);
  //   }
  //   const local = this.customers()
  //     .filter(customer => {
  //       const candidate = this.normalizeNationalId(
  //         this.valueOf(customer.idNationality ?? customer.identityNumber),
  //       );
  //       return candidate.startsWith(iqama);
  //     })
  //     .slice(0, 8);
  //   if (local.length > 0) {
  //     return of(local);
  //   }
  //   const fleetId =
  //     String(this.form.controls.fleetId.value ?? '').trim() || this.authState.fleetId() || undefined;
  //   return this.customerService
  //     .getPaginated({
  //       fleetId,
  //       pageNumber: 1,
  //       pageSize: 8,
  //       isActive: true,
  //       search: iqama,
  //     })
  //     .pipe(
  //       map(response => (response.items ?? []).slice(0, 8)),
  //       catchError(() => of([])),
  //     );
  // }

  paymentTypeIsCash(): boolean {
    return Number(this.form.controls.paymentType.value ?? 1) === 1;
  }

  paymentTypeIsBankOnly(): boolean {
    const type = Number(this.form.controls.paymentType.value ?? 1);
    return [2, 3, 4].includes(type);
  }

  paymentTypeIsMixed(): boolean {
    return Number(this.form.controls.paymentType.value ?? 1) === 5;
  }

  private applyPaymentTypeRules(type: number): void {
    const paid = Math.max(0, Number(this.form.controls.paid.value) || 0);
    const paidCashControl = this.form.controls.paidCash;
    const paidBankControl = this.form.controls.paidBank;
    const idCashControl = this.form.controls.idCash;
    const idBankControl = this.form.controls.idBank;

    if (type === 1) {
      paidCashControl.disable({ emitEvent: false });
      paidBankControl.disable({ emitEvent: false });
      idCashControl.enable({ emitEvent: false });
      idBankControl.disable({ emitEvent: false });
      this.form.patchValue(
        {
          paidCash: paid,
          paidBank: 0,
          idBank: '',
        },
        { emitEvent: false },
      );
      return;
    }

    if ([2, 3, 4].includes(type)) {
      paidCashControl.disable({ emitEvent: false });
      paidBankControl.disable({ emitEvent: false });
      idCashControl.disable({ emitEvent: false });
      idBankControl.enable({ emitEvent: false });
      this.form.patchValue(
        {
          paidCash: 0,
          paidBank: paid,
          idCash: '',
        },
        { emitEvent: false },
      );
      return;
    }

    paidCashControl.enable({ emitEvent: false });
    paidBankControl.enable({ emitEvent: false });
    idCashControl.enable({ emitEvent: false });
    idBankControl.enable({ emitEvent: false });

    const currentCash = Math.max(0, Number(paidCashControl.value) || 0);
    const currentBank = Math.max(0, Number(paidBankControl.value) || 0);
    if (currentCash === 0 && currentBank === 0 && paid > 0) {
      this.form.patchValue({ paidCash: paid, paidBank: 0 }, { emitEvent: false });
    }
  }

  private syncPaidByType(): void {
    const type = this.form.controls.paymentType.value;
    const paid = Math.max(0, Number(this.form.controls.paid.value) || 0);
    if (type === 1) {
      this.form.patchValue({ paidCash: paid, paidBank: 0 }, { emitEvent: false });
      return;
    }
    if ([2, 3, 4].includes(type)) {
      this.form.patchValue({ paidCash: 0, paidBank: paid }, { emitEvent: false });
    }
  }

  private validatePaymentInputs(): boolean {
    const raw = this.form.getRawValue();
    const paid = Math.max(0, Number(raw.paid) || 0);
    const paidCash = Math.max(0, Number(raw.paidCash) || 0);
    const paidBank = Math.max(0, Number(raw.paidBank) || 0);
    const type = Number(raw.paymentType) || 1;

    if (type === 1) {
      if (!raw.idCash.trim()) {
        this.toast.error(this.translate.instant('Select cash account'));
        return false;
      }
      return true;
    }

    if ([2, 3, 4].includes(type)) {
      if (!raw.idBank.trim()) {
        this.toast.error(this.translate.instant('Select bank'));
        return false;
      }
      return true;
    }

    if (!raw.idCash.trim() && paidCash > 0) {
      this.toast.error(this.translate.instant('Select cash account'));
      return false;
    }
    if (!raw.idBank.trim() && paidBank > 0) {
      this.toast.error(this.translate.instant('Select bank'));
      return false;
    }

    const sum = Math.round((paidCash + paidBank) * 100) / 100;
    const total = Math.round(paid * 100) / 100;
    if (sum !== total) {
      this.toast.error(this.translate.instant('Paid cash and bank must equal paid amount'));
      return false;
    }
    return true;
  }

  /** Common Saudi local format → E.164 (+9665xxxxxxxx) when applicable. */
  private normalizeSaudiMobile(value: string): string {
    const v = value.replace(/\s+/g, '');
    if (/^\+9665\d{8}$/.test(v)) {
      return v;
    }
    if (/^009665\d{8}$/.test(v)) {
      return `+966${v.slice(4)}`;
    }
    if (/^05\d{8}$/.test(v)) {
      return `+966${v.slice(1)}`;
    }
    if (/^5\d{8}$/.test(v)) {
      return `+966${v}`;
    }
    return value.trim();
  }

  /** Send API-friendly ISO dates when possible; otherwise pass through trimmed string. */
  private isoOrRaw(value: string | null | undefined): string {
    const s = this.valueOf(value);
    if (!s) {
      return '';
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString();
    }
    return s;
  }

  /**
   * Contract dates from `<input type="date">` (`yyyy-MM-dd`) → `yyyy-MM-ddTHH:mm:ss` for .NET `DateTime` binding.
   */
  private bookingCalendarDateToApi(value: string): string {
    const t = this.normalizeAsciiDigits(this.valueOf(value));
    if (!t) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(t)) {
      return `${t}:00`;
    }
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(t)) {
      return t;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return `${t}T00:00:00`;
    }
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }

  private toDateTimeLocalValue(date: Date): string {
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const min = String(date.getMinutes()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
  }

  private toDateTimeLocalFromApi(value: string | undefined): string {
    const text = this.valueOf(value);
    if (!text) {
      return '';
    }
    const date = new Date(text);
    return Number.isNaN(date.getTime()) ? '' : this.toDateTimeLocalValue(date);
  }

  private toDateInputValue(value: string | undefined): string {
    const text = this.valueOf(value);
    if (!text) {
      return '';
    }
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) {
      return '';
    }
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private refreshNationalitySuggestionList(): void {
    const q = this.valueOf(this.form.controls.customerNationality.value);
    this.nationalitySuggestions.set(
      searchBookingNationalities(q, {
        asia: this.translate.instant('NatBookingRegion.Asia'),
        africa: this.translate.instant('NatBookingRegion.Africa'),
        other: this.translate.instant('NatBookingRegion.RestOfWorld'),
      }),
    );
  }

  /**
   * License / birth dates: normalize Gregorian or ISO strings; empty if not parseable (API will reject Hijri-only text).
   */
  private customerDateFieldToApi(value: string): string {
    const t = this.normalizeAsciiDigits(this.valueOf(value));
    if (!t) {
      return '';
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      return `${t}T00:00:00`;
    }
    const d = new Date(t);
    return Number.isNaN(d.getTime()) ? '' : d.toISOString();
  }
}
