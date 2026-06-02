import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, of } from 'rxjs';

import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../shared/services/toast.service';
import { DatePickerComponent } from '../../../../shared/ui/date-picker/date-picker.component';
import { PageHeaderComponent } from '../../../../shared/ui/page-header/page-header.component';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
  SmoothSelectValue,
} from '../../../../shared/ui/smooth-select/smooth-select.component';
import { coerceFormNumber, requiredNumber } from '../../../../shared/validators/required-number.validator';
import { FileUploadComponent } from '../../../../shared/ui/file-upload/file-upload.component';
import { focusFirstInvalidControl } from '../../../../shared/utils/focus-first-invalid-control.util';
import { resolveMediaUrl } from '../../../../shared/utils/media-url.utils';
import { MaintenanceBranchOption } from '../../models/branch-reference.model';
import { SparePart } from '../../models/spare-part.model';
import { MaintenanceUpsertRequest } from '../../models/maintenance.model';
import { MaintenanceVehicleOption } from '../../models/vehicle-reference.model';
import { MaintenanceBranchService } from '../../services/maintenance-branch.service';
import { InsuranceCompanyService } from '../../services/insurance-company.service';
import { MaintenanceService } from '../../services/maintenance.service';
import { SparePartService } from '../../services/spare-part.service';
import { SupplierService } from '../../services/supplier.service';
import { MaintenanceVehicleService } from '../../services/maintenance-vehicle.service';

@Component({
  selector: 'app-maintenance-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
    PageHeaderComponent,
    SmoothSelectComponent,
    DatePickerComponent,
    FileUploadComponent,
  ],
  templateUrl: './maintenance-form.component.html',
  styleUrl: './maintenance-form.component.scss',
})
export class MaintenanceFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private authState = inject(AuthStateService);
  private maintenanceService = inject(MaintenanceService);
  private branchService = inject(MaintenanceBranchService);
  private vehicleService = inject(MaintenanceVehicleService);
  private insuranceCompanyService = inject(InsuranceCompanyService);
  private supplierService = inject(SupplierService);
  private sparePartService = inject(SparePartService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  maintenanceId = signal<string | null>(null);
  initializing = signal(true);
  saving = signal(false);
  branchOptions = signal<SmoothSelectOption[]>([]);
  vehicleOptions = signal<SmoothSelectOption[]>([]);
  insuranceOptions = signal<SmoothSelectOption[]>([]);
  supplierOptions = signal<SmoothSelectOption[]>([]);
  sparePartOptions = signal<SmoothSelectOption[]>([]);
  vehicles = signal<MaintenanceVehicleOption[]>([]);
  sparePartRows = signal<Array<{ idSparePartName: number | null; quantity: number }>>([]);
  loadingVehicle = signal(false);
  loadingInsurance = signal(false);
  loadingSupplier = signal(false);
  loadingSpareParts = signal(false);
  selectedImage = signal<File | null>(null);
  previewUrl = signal<string | null>(null);
  existingImageUrl = signal<string | null>(null);
  readonly imageFallback = 'assets/images/rent_icon/Maintenace.png';

  form = this.fb.group({
    idBranch: this.fb.control<number | null>(null, [Validators.required]),
    idVehicle: this.fb.control<number | null>(null, [Validators.required]),
    idBooking: this.fb.control<number | null>(null),
    idInsurancecompanies: this.fb.control<number | null>(null),
    idSupplier: this.fb.control<number | null>(null),
    startDate: ['', [Validators.required]],
    endDate: [''],
    odometerIn: [''],
    odometerOut: [''],
    durationMaintenance: [''],
    typeCompensation: [''],
    note: [''],
    valueCompensation: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    total: this.nullableFb.control<number | null>(null),
  });

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    const fleetId = this.authState.fleetId() ?? undefined;
    const openSparePartSection = this.route.snapshot.queryParamMap.get('section') === 'spare-parts';

    this.branchService.getList(fleetId).subscribe({
      next: branches => {
        this.branchOptions.set(this.toBranchOptions(branches));
        const defaultBranch = Number(this.authState.branchId() || 0);
        if (!id && defaultBranch > 0) {
          this.form.patchValue({ idBranch: defaultBranch });
          this.reloadVehicles(defaultBranch);
        } else if (!id) {
          this.reloadVehicles(null);
        }
      },
      error: () => this.branchOptions.set([]),
    });
    this.loadInsuranceCompanies(fleetId);
    this.loadSuppliers(fleetId);
    this.loadSpareParts(fleetId);

    if (id) {
      this.isEdit.set(true);
      this.maintenanceId.set(id);
      this.loadMaintenance(id);
      if (openSparePartSection) {
        setTimeout(() => this.scrollToSparePartsSection(), 0);
      }
    } else {
      this.initializing.set(false);
      if (openSparePartSection) {
        this.addSparePartRow();
        setTimeout(() => this.scrollToSparePartsSection(), 0);
      }
    }
  }

  onBranchChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idBranch = Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.form.controls.idBranch.setValue(idBranch);
    this.form.controls.idBranch.markAsTouched();
    this.form.controls.idVehicle.setValue(null);
    this.reloadVehicles(idBranch);
  }

  onImageSelected(file: File | null): void {
    this.selectedImage.set(file);
  }

  onInsuranceChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idInsurancecompanies =
      Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.form.controls.idInsurancecompanies.setValue(idInsurancecompanies);
    this.form.controls.idInsurancecompanies.markAsTouched();
  }

  onSupplierChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idSupplier = Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.form.controls.idSupplier.setValue(idSupplier);
    this.form.controls.idSupplier.markAsTouched();
  }

  onVehicleChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idVehicle = Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.form.controls.idVehicle.setValue(idVehicle);
    this.form.controls.idVehicle.markAsTouched();
  }

  addSparePartRow(): void {
    this.sparePartRows.update(rows => [...rows, { idSparePartName: null, quantity: 1 }]);
  }

  removeSparePartRow(index: number): void {
    this.sparePartRows.update(rows => rows.filter((_, i) => i !== index));
  }

  onSparePartChange(index: number, value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idSparePartName =
      Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.sparePartRows.update(rows =>
      rows.map((row, i) => (i === index ? { ...row, idSparePartName } : row)),
    );
  }

  onSparePartQtyChange(index: number, value: string): void {
    const qty = Number(value);
    this.sparePartRows.update(rows =>
      rows.map((row, i) => (i === index ? { ...row, quantity: Number.isFinite(qty) ? qty : 0 } : row)),
    );
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const fleetId = (this.authState.fleetId() ?? '').trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const raw = this.form.getRawValue();
    const idBranch = Number(raw.idBranch);
    const idVehicle = Number(raw.idVehicle);
    if (!Number.isFinite(idBranch) || idBranch <= 0) {
      this.toast.error(this.translate.instant('maintenance.invalidBranch'));
      return;
    }
    if (!Number.isFinite(idVehicle) || idVehicle <= 0) {
      this.toast.error(this.translate.instant('maintenance.invalidVehicle'));
      return;
    }

    let payload: MaintenanceUpsertRequest;
    try {
      payload = {
        id: this.maintenanceId() ?? undefined,
        fleetId,
        idBranch,
        idVehicle,
        idBooking: this.optionalPositiveLong(raw.idBooking),
        idInsurancecompanies: this.optionalPositiveLong(raw.idInsurancecompanies),
        idSupplier: this.optionalPositiveLong(raw.idSupplier),
        startDate: this.toApiDateTime(raw.startDate),
        endDate: raw.endDate?.trim() ? this.toApiDateTime(raw.endDate) : null,
        odometerIn: raw.odometerIn.trim() || null,
        odometerOut: raw.odometerOut.trim() || null,
        durationMaintenance: raw.durationMaintenance.trim() || null,
        typeCompensation: raw.typeCompensation.trim() || null,
        note: raw.note.trim() || null,
        valueCompensation: coerceFormNumber(raw.valueCompensation),
        total: raw.total != null ? coerceFormNumber(raw.total) : null,
        image: this.selectedImage(),
        existingUrl: this.existingImageUrl(),
        spareParts: this.normalizeSparePartRows(),
      };
    } catch {
      return;
    }

    this.saving.set(true);
    const req$ = this.isEdit()
      ? this.maintenanceService.update(payload)
      : this.maintenanceService.create(payload);

    req$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(this.isEdit() ? 'maintenance.updated' : 'maintenance.created'),
        );
        this.router.navigate(['/maintenance']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.saveFailed'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }

  private loadMaintenance(id: string): void {
    this.initializing.set(true);
    this.maintenanceService.getById(id, this.authState.fleetId()).subscribe({
      next: row => {
        this.reloadVehicles(row.idBranch, () => {
          this.form.patchValue({
            idBranch: row.idBranch,
            idVehicle: row.idVehicle,
            idBooking: row.idBooking,
            idInsurancecompanies: row.idInsurancecompanies,
            idSupplier: row.idSupplier ?? null,
            startDate: this.toDatetimeLocalValue(row.startDate),
            endDate: row.endDate ? this.toDatetimeLocalValue(row.endDate) : '',
            odometerIn: row.odometerIn ?? '',
            odometerOut: row.odometerOut ?? '',
            durationMaintenance: row.durationMaintenance ?? '',
            typeCompensation: row.typeCompensation ?? '',
            note: row.note ?? '',
            valueCompensation: row.valueCompensation,
            total: row.total ?? null,
          });
          this.sparePartRows.set(
            (row.spareParts ?? []).map(line => ({
              idSparePartName: line.idSparePartName,
              quantity: line.quantity,
            })),
          );
          this.setImagePreviewFromUrl(row.url);
          this.initializing.set(false);
        });
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.loadOneFailed'));
        this.initializing.set(false);
      },
    });
  }

  private reloadVehicles(branchId: number | null, after?: () => void): void {
    const fleetId = this.authState.fleetId() ?? undefined;
    this.loadingVehicle.set(true);
    this.vehicleService
      .getList({
        fleetId,
        branchId: branchId && branchId > 0 ? branchId : undefined,
      })
      .pipe(
        catchError(() => of([] as MaintenanceVehicleOption[])),
        finalize(() => {
          this.loadingVehicle.set(false);
          after?.();
        }),
      )
      .subscribe(vehicles => {
        this.vehicles.set(vehicles);
        this.vehicleOptions.set(this.toVehicleOptions(vehicles));
      });
  }

  private toBranchOptions(branches: MaintenanceBranchOption[]): SmoothSelectOption[] {
    return branches.map(b => ({
      label: this.isArabicUi()
        ? b.nameAr || b.nameEn || String(b.id)
        : b.nameEn || b.nameAr || String(b.id),
      value: b.id,
    }));
  }

  private toVehicleOptions(vehicles: MaintenanceVehicleOption[]): SmoothSelectOption[] {
    return vehicles
      .filter(v => Number.isFinite(Number(v.id)) && Number(v.id) > 0)
      .map(v => {
        const plate = v.plateNumber?.trim() || '';
        const serial = v.serialNumber?.trim() || '';
        const label = [plate, serial].filter(Boolean).join(' — ') || String(v.id);
        return { label, value: Number(v.id) };
      });
  }

  private loadInsuranceCompanies(fleetId?: string): void {
    this.loadingInsurance.set(true);
    this.insuranceCompanyService
      .getList(fleetId)
      .pipe(
        catchError(() => of([])),
        finalize(() => this.loadingInsurance.set(false)),
      )
      .subscribe(companies => {
        const options = companies
          .filter(c => Number.isFinite(Number(c.id)) && Number(c.id) > 0)
          .map(c => ({
            label: c.name?.trim() || String(c.id),
            value: Number(c.id),
          }));
        this.insuranceOptions.set(options);
      });
  }

  private loadSuppliers(fleetId?: string): void {
    this.loadingSupplier.set(true);
    this.supplierService
      .getList(fleetId)
      .pipe(
        catchError(() => of([])),
        finalize(() => this.loadingSupplier.set(false)),
      )
      .subscribe(suppliers => {
        const options = suppliers
          .filter(s => Number.isFinite(Number(s.id)) && Number(s.id) > 0)
          .map(s => ({
            label: s.supplierName?.trim() || String(s.id),
            value: Number(s.id),
          }));
        this.supplierOptions.set(options);
      });
  }

  private loadSpareParts(fleetId?: string): void {
    this.loadingSpareParts.set(true);
    this.sparePartService
      .getPaginated({
        fleetId,
        pageNumber: 1,
        pageSize: 1000,
      })
      .pipe(
        catchError(() =>
          of({
            items: [] as SparePart[],
            totalCount: 0,
            totalPages: 0,
            pageNumber: 1,
            pageSize: 1000,
          }),
        ),
        finalize(() => this.loadingSpareParts.set(false)),
      )
      .subscribe(response => {
        const options = (response.items ?? [])
          .filter(x => Number.isFinite(Number(x.id)) && Number(x.id) > 0)
          .map(x => ({
            label: x.name?.trim() || String(x.id),
            value: Number(x.id),
          }));
        this.sparePartOptions.set(options);
      });
  }

  private normalizeSparePartRows(): Array<{ idSparePartName: number; quantity: number }> {
    const normalized = this.sparePartRows()
      .map(row => ({
        idSparePartName: Number(row.idSparePartName),
        quantity: Number(row.quantity),
      }))
      .filter(row => Number.isFinite(row.idSparePartName) && row.idSparePartName > 0);

    const invalidQty = normalized.some(row => !Number.isFinite(row.quantity) || row.quantity <= 0);
    if (invalidQty) {
      this.toast.error(this.translate.instant('maintenance.sparePart.invalidRow'));
      throw new Error('Invalid spare part quantity');
    }

    const dedup = new Map<number, number>();
    for (const row of normalized) {
      dedup.set(row.idSparePartName, (dedup.get(row.idSparePartName) ?? 0) + row.quantity);
    }
    return Array.from(dedup.entries()).map(([idSparePartName, quantity]) => ({
      idSparePartName,
      quantity,
    }));
  }

  private optionalPositiveLong(value: number | null | undefined): number | null {
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      return null;
    }
    return Number(value);
  }

  private toDatetimeLocalValue(iso: string): string {
    if (!iso?.trim()) {
      return '';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
      return '';
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  private toApiDateTime(local: string): string {
    const d = new Date(local);
    if (Number.isNaN(d.getTime())) {
      return local;
    }
    return d.toISOString();
  }

  private setImagePreviewFromUrl(url?: string | null): void {
    const raw = url?.trim() || '';
    this.existingImageUrl.set(raw || null);
    if (!raw) {
      this.previewUrl.set(null);
      return;
    }
    if (raw.startsWith('data:')) {
      this.previewUrl.set(raw);
      return;
    }
    this.previewUrl.set(resolveMediaUrl(raw));
  }

  private isArabicUi(): boolean {
    const lang = (
      this.translate.currentLang ||
      this.translate.getDefaultLang() ||
      'en'
    ).toLowerCase();
    return lang.startsWith('ar');
  }

  private scrollToSparePartsSection(): void {
    const el = this.hostEl.nativeElement.querySelector('#maintenance-spare-parts');
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
