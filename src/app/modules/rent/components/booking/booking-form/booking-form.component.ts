import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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
  switchMap,
} from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { PaginatedAggregatorResponse } from '../../../../../core/interfaces';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { Bank } from '../../../../finance/models/banks/bank.model';
import { CashAccount } from '../../../../finance/models/cash/cash-account.model';
import { CountingEntry } from '../../../../finance/models/counting/counting-entry.model';
import { BankService } from '../../../../finance/services/banks/bank.service';
import { CashAccountService } from '../../../../finance/services/cash/cash-account.service';
import { CountingEntryService } from '../../../../finance/services/counting/counting-entry.service';
import { BookingCreateRequest, CategoryVehicle, Customer, Vehicle } from '../../../models';
import { Setting } from '../../../models/settings/setting.model';
import { normalizeSetting } from '../../../models/settings/setting.normalizer';
import { BookingService } from '../../../services/booking/booking.service';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';
import { CustomerService } from '../../../services/customers/customer.service';
import { SettingService } from '../../../services/settings/setting.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';

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

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private router = inject(Router);
  private bookingService = inject(BookingService);
  private customerService = inject(CustomerService);
  private vehicleService = inject(VehicleService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private bankService = inject(BankService);
  private cashAccountService = inject(CashAccountService);
  private countingEntryService = inject(CountingEntryService);
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
  customerSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select customer', value: '' },
    ...this.customers().map(customer => ({
      label: customer.fullName || customer.nameAr || customer.nameEn || '-',
      value: String(customer.id),
    })),
  ]);
  vehicleSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select vehicle', value: '' },
    ...this.vehicles().map(vehicle => ({
      label: vehicle.plateNumber || vehicle.serialNumber || vehicle.make || '-',
      value: String(vehicle.id),
    })),
  ]);
  bankSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select bank', value: '' },
    ...this.banks().map(bank => ({
      label: bank.name || '-',
      value: String(bank.id),
    })),
  ]);
  cashSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select cash account', value: '' },
    ...this.cashAccounts().map(cash => ({
      label: cash.name || '-',
      value: String(cash.id),
    })),
  ]);
  paymentTypeSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Cash'), value: 1 },
    { label: this.translate.instant('Network/POS'), value: 2 },
    { label: this.translate.instant('Cheque'), value: 3 },
    { label: this.translate.instant('Bank Transfer'), value: 4 },
    { label: this.translate.instant('Bank/Cash'), value: 5 },
  ]);
  discountTypeSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: this.translate.instant('Fixed Amount'), value: 'amount' },
    { label: this.translate.instant('Percentage'), value: 'percent' },
  ]);
  countingSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select customer vehicle counting', value: '' },
    ...this.countingEntries().map(counting => ({
      label: [counting.nameAr, counting.nameEn].filter(Boolean).join(' - ') || String(counting.id),
      value: String(counting.id),
    })),
  ]);

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
    customerNationality: ['', [Validators.maxLength(100)]],
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
    numberOfHoursExcess: [0, [Validators.required, Validators.min(0)]],
    numberKmExcess: [0, [Validators.required, Validators.min(0)]],
    dayExcess: [0, [Validators.required, Validators.min(0)]],
    discountType: ['amount' as 'amount' | 'percent'],
    discount: [0, [Validators.required, Validators.min(0)]],
    checkoutCounter: [0, [Validators.required, Validators.min(0)]],
    checkinCounter: [0, [Validators.required, Validators.min(0)]],
    countOfDay: [0, [Validators.required, Validators.min(0)]],
    priceInDay: [0, [Validators.required, Validators.min(0)]],
    /** Category / policy daily band — editable; contract daily defaults to upper band when no vehicle rate. */
    priceDayBandLow: [0, [Validators.required, Validators.min(0)]],
    priceDayBandHigh: [0, [Validators.required, Validators.min(0)]],
    priceInMonth: [0, [Validators.required, Validators.min(0)]],
    allowTo: [0, [Validators.required, Validators.min(0)]],
    countKMExtra: [0, [Validators.required, Validators.min(0)]],
    priceHoureExtra: [0, [Validators.required, Validators.min(0)]],
    priceHourExtraBandLow: [0, [Validators.required, Validators.min(0)]],
    priceHourExtraBandHigh: [0, [Validators.required, Validators.min(0)]],
    priceKmExtra: [0, [Validators.required, Validators.min(0)]],
    priceKmExtraBandLow: [0, [Validators.required, Validators.min(0)]],
    priceKmExtraBandHigh: [0, [Validators.required, Validators.min(0)]],
    otherExpenses: [0, [Validators.required, Validators.min(0)]],
    total: [0, [Validators.required, Validators.min(0)]],
    note: ['', [Validators.maxLength(500), Validators.pattern(BookingFormComponent.NOTE_REGEX)]],
    placeUSE: [
      '',
      [Validators.maxLength(200), Validators.pattern(BookingFormComponent.PLACE_USE_REGEX)],
    ],
    totalTrafic: [0, [Validators.required, Validators.min(0)]],
    totalMaintance: [0, [Validators.required, Validators.min(0)]],
    totalReceivedVehicle: [0, [Validators.required, Validators.min(0)]],
    transportationFees: [0, [Validators.required, Validators.min(0)]],
    totaltax: [0, [Validators.required, Validators.min(0)]],
    paid: [0, [Validators.required, Validators.min(0)]],
    paidCash: [0, [Validators.required, Validators.min(0)]],
    paidBank: [0, [Validators.required, Validators.min(0)]],
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
    const fleetId = this.authState.fleetId() || undefined;
    const branchId = Number(this.authState.branchId() || 0) || undefined;
    const emptyCategories: PaginatedAggregatorResponse<CategoryVehicle> = {
      items: [],
      pageNumber: 1,
      pageSize: 200,
      totalCount: 0,
      totalPages: 0,
    };
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
      categories: this.categoryVehicleService
        .getPaginated({
          fleetId,
          pageNumber: 1,
          pageSize: 200,
          search: '',
        })
        .pipe(catchError(() => of(emptyCategories))),
      banks: this.bankService.getList(fleetId).pipe(catchError(() => of([]))),
      cashAccounts: this.cashAccountService.getList(fleetId).pipe(catchError(() => of([]))),
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
        this.categories.set(categories.items ?? []);
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
            return of<Customer[]>([]);
          }
          if (iqama.length < BookingFormComponent.NATIONAL_ID_LENGTH) {
            this.form.patchValue({ customerId: '' }, { emitEvent: false });
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
    this.syncBookingTotals();
    this.refreshContractLimitWarnings();
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
      idCustomerOut = this.parseFormNumber(raw.customerId);
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
    const idBranch = this.parseFormNumber(raw.branchId);
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
    const selectedVehicle = this.selectedVehicle();
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
      checkoutCounter: raw.checkoutCounter,
      total: raw.total,
      startDate: startApi,
      endDate: endApi,
      countOfDay: raw.countOfDay,
      dateReturnVehical: returnApi,
      priceInDay: raw.priceInDay,
      allowTo: raw.allowTo,
      countKMExtra: raw.countKMExtra,
      priceHoureExtra: raw.priceHoureExtra,
      idBank,
      idCash,
      note: raw.note.trim() || undefined,
      placeUSE: raw.placeUSE.trim() || undefined,
      paidCash: raw.paidCash,
      paidBank: raw.paidBank,
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
      numberOfHoursExcess: raw.numberOfHoursExcess,
      numberKmExcess: raw.numberKmExcess,
      dayExcess: raw.dayExcess,
      discount: raw.discount,
      checkinCounter: raw.checkinCounter,
      priceInMonth: raw.priceInMonth,
      priceKmExtra: raw.priceKmExtra,
      otherExpenses: raw.otherExpenses,
      totalTrafic: raw.totalTrafic,
      totalMaintance: raw.totalMaintance,
      totalReceivedVehicle: raw.totalReceivedVehicle,
      transportationFees: raw.transportationFees,
      totaltax: raw.totaltax,
      paid: raw.paid,
    };

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

  selectedCustomer(): Customer | null {
    const customerId = this.form.controls.customerId.value;
    if (!customerId) {
      return null;
    }
    return this.customers().find(customer => String(customer.id) === String(customerId)) ?? null;
  }

  // customerIqamaSuggestionsEnabled(): boolean {
  //   return false;
  // }

  customerLookupByIqama(iqamaInput?: string): void {
    const iqama = this.normalizeNationalId(
      iqamaInput ?? this.form.controls.customerIqama.value.trim(),
    );
    if (!iqama) {
      this.form.patchValue({ customerId: '' }, { emitEvent: false });
      return;
    }
    if (iqama.length !== BookingFormComponent.NATIONAL_ID_LENGTH) {
      this.form.patchValue({ customerId: '' }, { emitEvent: false });
      return;
    }
    const localMatch = this.customers().find(customer => {
      const candidate = this.normalizeNationalId(
        this.valueOf(customer.idNationality ?? customer.identityNumber),
      );
      return candidate === iqama;
    });
    if (localMatch) {
      this.form.patchValue({ customerId: String(localMatch.id) }, { emitEvent: false });
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
            return of(null);
          }
          return this.customerService
            .getById(String(match.id), fleetId)
            .pipe(catchError(() => of(match)));
        }),
      )
      .subscribe({
        next: customer => {
          if (customer) {
            const exists = this.customers().some(item => String(item.id) === String(customer.id));
            if (!exists) {
              this.customers.set([...this.customers(), customer]);
            }
            this.form.patchValue(
              {
                customerId: String(customer.id),
                customerNameAr: '',
                customerFirstMobileNumber: '',
                customerAddress: '',
                customerNationality: '',
                customerDrivingLicenseNumber: '',
                customerDateDrivinglicense: '',
                customerBirthDay: '',
              },
              { emitEvent: false },
            );
            return;
          }
          const currentSelected = this.selectedCustomer();
          const currentSelectedIqama = currentSelected
            ? this.normalizeAsciiDigits(
                this.valueOf(currentSelected.idNationality ?? currentSelected.identityNumber),
              )
            : '';
          if (currentSelectedIqama !== iqama) {
            this.form.patchValue({ customerId: '' }, { emitEvent: false });
          }
        },
        error: () => {},
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

  private pickNumeric(currentValue: number, incoming: number | null | undefined): number {
    if (typeof incoming === 'number' && Number.isFinite(incoming)) {
      return incoming;
    }
    return currentValue;
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
