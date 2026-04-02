import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { BookingUpsertRequest, Customer, Vehicle } from '../../../models';
import { BookingService } from '../../../services/booking/booking.service';
import { CustomerService } from '../../../services/customers/customer.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';

@Component({
  selector: 'app-booking-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent, SmoothSelectComponent],
  templateUrl: './booking-form.component.html',
  styleUrl: './booking-form.component.scss',
})
export class BookingFormComponent implements OnInit {
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
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  customers = signal<Customer[]>([]);
  vehicles = signal<Vehicle[]>([]);
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

  private readonly customerBasicFields: Array<{
    label: string;
    resolver: (customer: Customer) => string;
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
          customer.dateDrivinglicenseHajri ??
            customer.dateDrivinglicense ??
            customer.drivingLicenseExpiryDate,
        ),
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
    customerId: ['', [Validators.required]],
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
    discount: [0, [Validators.required, Validators.min(0)]],
    checkoutCounter: [0, [Validators.required, Validators.min(0)]],
    checkinCounter: [0, [Validators.required, Validators.min(0)]],
    countOfDay: [0, [Validators.required, Validators.min(0)]],
    priceInDay: [0, [Validators.required, Validators.min(0)]],
    priceInMonth: [0, [Validators.required, Validators.min(0)]],
    allowTo: [0, [Validators.required, Validators.min(0)]],
    countKMExtra: [0, [Validators.required, Validators.min(0)]],
    priceHoureExtra: [0, [Validators.required, Validators.min(0)]],
    priceKmExtra: [0, [Validators.required, Validators.min(0)]],
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
    forkJoin({
      customers: this.customerService.getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 100,
        isActive: true,
      }),
      vehicles: this.vehicleService.getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 100,
        status: 'Available',
      }),
    }).subscribe({
      next: ({ customers, vehicles }) => {
        this.customers.set(customers.items ?? []);
        this.vehicles.set(vehicles.items ?? []);
      },
      error: () => this.toast.error(this.translate.instant('Failed to load booking references')),
    });

    this.form.controls.vehicleId.valueChanges.subscribe(() => {
      this.syncVehicleRelations();
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
    const missingCustomerBasics = this.getMissingCustomerBasicFields(selectedCustomer);
    if (missingCustomerBasics.length > 0) {
      const message = this.translate.instant('Complete customer basic information before booking');
      this.toast.error(`${message}: ${missingCustomerBasics.join('، ')}`);
      return;
    }

    const body: BookingUpsertRequest = {
      idVehicle: Number(raw.vehicleId),
      idCustomer: Number(raw.customerId),
      idBranch: Number(raw.branchId),
      fleetId: raw.fleetId,
      distancetraveledgps: raw.distancetraveledgps.trim() || undefined,
      numberOfHoursExcess: raw.numberOfHoursExcess,
      numberKmExcess: raw.numberKmExcess,
      dayExcess: raw.dayExcess,
      discount: raw.discount,
      checkoutCounter: raw.checkoutCounter,
      checkinCounter: raw.checkinCounter,
      countOfDay: raw.countOfDay,
      priceInDay: raw.priceInDay,
      priceInMonth: raw.priceInMonth,
      allowTo: raw.allowTo,
      countKMExtra: raw.countKMExtra,
      priceHoureExtra: raw.priceHoureExtra,
      priceKmExtra: raw.priceKmExtra,
      otherExpenses: raw.otherExpenses,
      total: raw.total,
      startDate: raw.startDate,
      endDate: raw.endDate,
      dateReturnVehical: raw.dateReturnVehical,
      note: raw.note.trim() || undefined,
      placeUSE: raw.placeUSE.trim() || undefined,
      totalTrafic: raw.totalTrafic,
      totalMaintance: raw.totalMaintance,
      totalReceivedVehicle: raw.totalReceivedVehicle,
      transportationFees: raw.transportationFees,
      totaltax: raw.totaltax,
      numberBookingINBasame: raw.numberBookingINBasame.trim(),
    };

    this.loading.set(true);
    this.bookingService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Booking created'));
        this.router.navigate(['/booking']);
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false),
    });
  }

  selectedCustomer(): Customer | null {
    const customerId = this.form.controls.customerId.value;
    if (!customerId) {
      return null;
    }
    return this.customers().find(customer => String(customer.id) === String(customerId)) ?? null;
  }

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
      return [this.translate.instant('Customer')];
    }

    const missing = this.customerBasicFields
      .filter(field => !field.resolver(customer))
      .map(field => this.translate.instant(field.label));

    if (!this.customerContractNumber()) {
      missing.push(this.translate.instant('Rental Contract Number'));
    }

    return missing;
  }

  vehicleInfoValue(field: 'plateNumber' | 'type' | 'model' | 'color'): string {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return '-';
    }

    if (field === 'plateNumber') {
      return this.valueOf(vehicle.plateNumber) || '-';
    }

    if (field === 'type') {
      return this.valueOf(vehicle.categoryName ?? vehicle.make) || '-';
    }

    if (field === 'model') {
      const model = this.valueOf(vehicle.model);
      const year = vehicle.year ? ` (${vehicle.year})` : '';
      return `${model}${year}`.trim() || '-';
    }

    return this.valueOf(vehicle.color) || '-';
  }

  private syncVehicleRelations(): void {
    const vehicle = this.selectedVehicle();
    if (!vehicle) {
      return;
    }

    const raw = this.form.getRawValue();
    this.form.patchValue(
      {
        branchId: vehicle.branchId && vehicle.branchId > 0 ? vehicle.branchId : raw.branchId,
        priceInDay: this.pickNumeric(raw.priceInDay, vehicle.dailyRate),
        priceInMonth: this.pickNumeric(raw.priceInMonth, vehicle.monthlyRate),
        checkoutCounter: this.pickNumeric(raw.checkoutCounter, vehicle.mileage),
      },
      { emitEvent: false },
    );
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
}
