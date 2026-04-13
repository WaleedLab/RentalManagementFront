import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { map, of, switchMap } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { Branch, CategoryVehicle, VehicleStatus, VehicleUpsertRequest } from '../../../models';
import { FieldValueStateDirective } from '../../../../../shared/directives/field-value-state.directive';
import { ToastService } from '../../../../../shared/services/toast.service';
import { BranchService } from '../../../services/branches/branch.service';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import { resolveMediaUrl } from '../../../../../shared/utils/media-url.utils';
import { FileUploadComponent } from '../../../../../shared/ui/file-upload/file-upload.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-vehicle-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    FieldValueStateDirective,
    FileUploadComponent,
    PageHeaderComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './vehicle-form.component.html',
  styleUrl: './vehicle-form.component.scss',
})
export class VehicleFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly SERIAL_NUMBER_REGEX = /^[A-Za-z0-9-]{1,50}$/;
  private static readonly PLATE_NUMBER_REGEX = /^[A-Za-z0-9-\u0600-\u06FF\s]{1,20}$/;
  private static readonly VIN_REGEX = /^[A-HJ-NPR-Z0-9]{11,17}$/i;
  private static readonly INSURANCE_POLICY_REGEX = /^[A-Za-z0-9-]{1,100}$/;
  private static readonly INSURANCE_NUMBER_REGEX = /^[A-Za-z0-9-]{0,50}$/;
  private static readonly ENGINE_REGEX = /^[A-Za-z0-9.\s-]{0,60}$/;

  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private branchService = inject(BranchService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private vehicleService = inject(VehicleService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  isViewMode = signal(false);
  vehicleId = signal<string | null>(null);
  originalStatus = signal<VehicleStatus>('Available');
  loading = signal(false);
  selectedImage = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  branches = signal<Branch[]>([]);
  categories = signal<CategoryVehicle[]>([]);
  private readonly vehicleFallbackImage = 'assets/images/rent_icon/car_defulte.png';
  readonly statusSelectOptions: SmoothSelectOption[] = [
    { label: 'Available', value: 'Available' },
    { label: 'Booked', value: 'Booked' },
    { label: 'Maintenance', value: 'Maintenance' },
    { label: 'Inactive', value: 'Inactive' },
  ];
  branchSelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select branch', value: null },
    ...this.branches().map(branch => ({
      label: this.getBranchLabel(branch),
      value: Number(branch.id),
    })),
  ]);
  categorySelectOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select category', value: null },
    ...this.categories().map(category => ({
      label: this.getCategoryLabel(category),
      value: Number(category.id),
    })),
  ]);

  form = this.fb.group({
    fleetId: [this.authState.fleetId() || '', [Validators.required]],
    branchId: [null as number | null, [Validators.required, Validators.min(1)]],
    idCategoryVehicle: [null as number | null, [Validators.required, Validators.min(1)]],
    serialNumber: ['', [Validators.required, Validators.maxLength(50), Validators.pattern(VehicleFormComponent.SERIAL_NUMBER_REGEX)]],
    engine: ['', [Validators.maxLength(60), Validators.pattern(VehicleFormComponent.ENGINE_REGEX)]],
    yearMake: [new Date().getFullYear(), [Validators.required, Validators.min(1900), Validators.max(new Date().getFullYear() + 1)]],
    plateNumber: ['', [Validators.required, Validators.maxLength(20), Validators.pattern(VehicleFormComponent.PLATE_NUMBER_REGEX)]],
    vin: ['', [Validators.minLength(11), Validators.maxLength(17), Validators.pattern(VehicleFormComponent.VIN_REGEX)]],
    color: ['', [Validators.maxLength(30)]],
    insuranceNumber: ['', [Validators.maxLength(50), Validators.pattern(VehicleFormComponent.INSURANCE_NUMBER_REGEX)]],
    insuranceType: [null as number | null],
    insuranceExpires: ['', [Validators.required]],
    licenseExpirationDate: ['', [Validators.required]],
    insurancePolicyNumber: ['', [Validators.required, Validators.maxLength(100), Validators.pattern(VehicleFormComponent.INSURANCE_POLICY_REGEX)]],
    operatinCard: ['', [Validators.required]],
    validityCarRegistration: ['', [Validators.required]],
    countKm: [0, [Validators.min(0)]],
    capacitOil: [0, [Validators.min(0)]],
    status: ['Available' as VehicleStatus],
    isActive: [true],
    notes: [''],
  });

  ngOnInit(): void {
    this.isViewMode.set(Boolean(this.route.snapshot.data?.['viewOnly']));
    const fleetId = this.authState.fleetId();
    if (fleetId) {
      this.branchService.getPaginated({ fleetId, pageNumber: 1, pageSize: 100 }).subscribe({
        next: page => this.branches.set(page.items ?? []),
        error: () => this.toast.error(this.translate.instant('Failed to load branches')),
      });

      this.categoryVehicleService.getPaginated({ fleetId, pageNumber: 1, pageSize: 100 }).subscribe({
        next: page => this.categories.set(page.items ?? []),
        error: () => this.toast.error(this.translate.instant('Failed to load categories')),
      });
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      if (this.isViewMode()) {
        this.router.navigate(['/vehicles']);
      }
      return;
    }

    this.isEdit.set(true);
    this.vehicleId.set(id);
    this.loading.set(true);
    this.vehicleService.getById(id, this.authState.fleetId() ?? '').subscribe({
      next: vehicle => {
        this.previewUrl.set(resolveMediaUrl(vehicle.imageUrl));
        this.form.patchValue({
          fleetId: vehicle.fleetId,
          branchId: vehicle.branchId ?? null,
          idCategoryVehicle:
            vehicle.idCategoryVehicle ??
            (vehicle.categoryVehicleId ? Number(vehicle.categoryVehicleId) : null),
          serialNumber: vehicle.serialNumber ?? vehicle.make,
          engine: vehicle.engine ?? vehicle.model,
          yearMake: vehicle.yearMake ?? vehicle.year,
          plateNumber: vehicle.plateNumber,
          vin: vehicle.vin || '',
          color: vehicle.color || '',
          insuranceNumber: vehicle.insuranceNumber || '',
          insuranceType: vehicle.insuranceType ?? null,
          insuranceExpires: this.toDateInputValue(vehicle.insuranceExpires),
          licenseExpirationDate: this.toDateInputValue(vehicle.licenseExpirationDate),
          insurancePolicyNumber: vehicle.insurancePolicyNumber || '',
          operatinCard: this.toDateInputValue(vehicle.operatinCard),
          validityCarRegistration: this.toDateInputValue(vehicle.validityCarRegistration),
          countKm: vehicle.countKm ?? vehicle.mileage ?? 0,
          capacitOil: vehicle.capacitOil ?? vehicle.seats ?? 0,
          status: vehicle.status,
          isActive: vehicle.isActive,
          notes: vehicle.notes || '',
        });
        this.originalStatus.set(vehicle.status);

        if (this.isViewMode()) {
          this.form.disable({ emitEvent: false });
        }
      },
      error: () => this.toast.error(this.translate.instant('Failed to load vehicle')),
      complete: () => this.loading.set(false),
    });
  }

  onImageSelected(file: File | null): void {
    if (this.isViewMode()) {
      return;
    }
    this.selectedImage.set(file);
  }

  onPreviewImageError(event: Event): void {
    const image = event.target as HTMLImageElement | null;
    if (!image) {
      return;
    }

    if (image.getAttribute('src') !== this.vehicleFallbackImage) {
      image.setAttribute('src', this.vehicleFallbackImage);
    }

    this.previewUrl.set(this.vehicleFallbackImage);
  }

  getBranchLabel(branch: Branch): string {
    return this.isArabicUi() ? branch.nameAr || branch.nameEn || '-' : branch.nameEn || branch.nameAr || '-';
  }

  getCategoryLabel(category: CategoryVehicle): string {
    return this.isArabicUi() ? category.nameAr || category.nameEn || '-' : category.nameEn || category.nameAr || '-';
  }

  getPreviewImageUrl(): string {
    return this.previewUrl() || this.vehicleFallbackImage;
  }

  getPageTitleKey(): string {
    if (this.isViewMode()) {
      return 'Vehicle Preview';
    }

    return this.isEdit() ? 'Edit Vehicle' : 'Create Vehicle';
  }

  getPageSubtitleKey(): string {
    if (this.isViewMode()) {
      return 'Preview vehicle information in read-only mode.';
    }

    return 'Vehicle records with pricing, status, and image upload.';
  }

  private toDateInputValue(value?: string): string {
    if (!value) {
      return '';
    }

    const normalized = String(value).trim();
    if (!normalized) {
      return '';
    }

    return normalized.length >= 10 ? normalized.slice(0, 10) : normalized;
  }

  private isArabicUi(): boolean {
    const lang = (this.translate.currentLang || this.translate.getDefaultLang() || 'en').toLowerCase();
    return lang.startsWith('ar');
  }

  save(): void {
    if (this.isViewMode()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const selectedStatus = raw.status;
    const body: VehicleUpsertRequest = {
      id: this.vehicleId() || undefined,
      fleetId: raw.fleetId,
      branchId: Number(raw.branchId),
      idCategoryVehicle: Number(raw.idCategoryVehicle),
      serialNumber: raw.serialNumber,
      engine: raw.engine || undefined,
      yearMake: raw.yearMake,
      plateNumber: raw.plateNumber,
      vin: raw.vin || undefined,
      color: raw.color || undefined,
      insuranceNumber: raw.insuranceNumber || undefined,
      insuranceType: raw.insuranceType,
      insuranceExpires: raw.insuranceExpires,
      licenseExpirationDate: raw.licenseExpirationDate,
      insurancePolicyNumber: raw.insurancePolicyNumber,
      operatinCard: raw.operatinCard,
      validityCarRegistration: raw.validityCarRegistration,
      countKm: raw.countKm,
      capacitOil: raw.capacitOil,
      status: raw.status,
      isActive: raw.isActive,
      notes: raw.notes || undefined,
      image: this.selectedImage(),
    };

    this.loading.set(true);
    const request$ = this.isEdit() ? this.vehicleService.update(body) : this.vehicleService.create(body);
    request$
      .pipe(
        switchMap(response => {
          if (!this.shouldSyncStatus(selectedStatus)) {
            return of(response);
          }

          const targetVehicleId = this.resolveVehicleIdForStatusSync(response);
          if (!targetVehicleId) {
            return of(response);
          }

          return this.vehicleService.changeStatus(targetVehicleId, selectedStatus).pipe(map(() => response));
        }),
      )
      .subscribe({
      next: () => {
        this.originalStatus.set(selectedStatus);
        this.toast.success(this.translate.instant(this.isEdit() ? 'Vehicle updated' : 'Vehicle created'));
        this.router.navigate(['/vehicles']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save vehicle'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private shouldSyncStatus(selectedStatus: VehicleStatus): boolean {
    if (this.isEdit()) {
      return selectedStatus !== this.originalStatus();
    }

    // Backend create command always initializes status as IsAvalible.
    return selectedStatus !== 'Available';
  }

  private resolveVehicleIdForStatusSync(response: unknown): number | null {
    const editId = Number(this.vehicleId() ?? 0);
    if (Number.isFinite(editId) && editId > 0) {
      return editId;
    }

    const candidate = this.extractNumericId(response);
    if (candidate) {
      return candidate;
    }

    if (response && typeof response === 'object') {
      const fromData = this.extractNumericId((response as Record<string, unknown>)['data']);
      if (fromData) {
        return fromData;
      }
    }

    return null;
  }

  private extractNumericId(value: unknown): number | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const source = value as Record<string, unknown>;
    const numericId = Number(source['id'] ?? source['Id'] ?? 0);
    if (!Number.isFinite(numericId) || numericId <= 0) {
      return null;
    }

    return numericId;
  }
}






