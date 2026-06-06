import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, merge, of } from 'rxjs';

import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../shared/services/toast.service';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
  SmoothSelectValue,
} from '../../../../shared/ui/smooth-select/smooth-select.component';
import { focusFirstInvalidControl } from '../../../../shared/utils/focus-first-invalid-control.util';
import { MaintenanceUpsertRequest } from '../../models/maintenance.model';
import { MaintenanceVehicleOption } from '../../models/vehicle-reference.model';
import { InsuranceCompanyService } from '../../services/insurance-company.service';
import { MaintenanceService } from '../../services/maintenance.service';
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
    SmoothSelectComponent,
  ],
  templateUrl: './maintenance-form.component.html',
  styleUrl: './maintenance-form.component.scss',
})
export class MaintenanceFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'maintenance-form-section-vehicle',
    'maintenance-form-section-linking',
    'maintenance-form-section-extra',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private maintenanceService = inject(MaintenanceService);
  private vehicleService = inject(MaintenanceVehicleService);
  private insuranceCompanyService = inject(InsuranceCompanyService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  maintenanceId = signal<string | null>(null);
  initializing = signal(true);
  saving = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);
  vehicleOptions = signal<SmoothSelectOption[]>([]);
  insuranceOptions = signal<SmoothSelectOption[]>([]);
  loadingVehicle = signal(false);
  loadingInsurance = signal(false);

  form = this.fb.group({
    idVehicle: this.fb.control<number | null>(null, [Validators.required]),
    idBooking: this.fb.control<number | null>(null),
    idInsurancecompanies: this.fb.control<number | null>(null),
    note: [''],
  });

  vehicleSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.idVehicle.valid;
  });

  linkingSectionComplete = computed(() => {
    this.formProgressTick();
    return this.vehicleSectionComplete() && this.form.controls.idBooking.valid;
  });

  extraSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return this.vehicleSectionComplete() && f.idInsurancecompanies.valid && f.note.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.vehicleSectionComplete()) done++;
    if (this.linkingSectionComplete()) done++;
    if (this.extraSectionComplete()) done++;
    return Math.round((done / 3) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.vehicleSectionComplete()) return 1;
    if (!this.linkingSectionComplete()) return 2;
    if (!this.extraSectionComplete()) return 3;
    return 4;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const id = this.route.snapshot.paramMap.get('id');
    const fleetId = this.resolveFleetId() ?? undefined;

    this.loadVehicles(fleetId);
    this.loadInsuranceCompanies(fleetId);

    if (id) {
      const idNum = Number(id);
      if (!Number.isFinite(idNum) || idNum <= 0) {
        this.toast.error(this.translate.instant('maintenance.loadOneFailed'));
        this.initializing.set(false);
        return;
      }
      this.isEdit.set(true);
      this.maintenanceId.set(String(idNum));
      this.loadMaintenance(String(idNum), fleetId);
    } else {
      this.applyVehicleFromQuery();
      this.initializing.set(false);
    }
  }

  onVehicleChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idVehicle = Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.form.controls.idVehicle.setValue(idVehicle);
    this.form.controls.idVehicle.markAsTouched();
  }

  focusWorkflowSection(step: 1 | 2 | 3): void {
    const sectionId = MaintenanceFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('maintenance-form-section--focus');
    window.setTimeout(() => section.classList.remove('maintenance-form-section--focus'), 1400);
  }

  hasError(controlName: 'idVehicle'): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  onInsuranceChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idInsurancecompanies =
      Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.form.controls.idInsurancecompanies.setValue(idInsurancecompanies);
    this.form.controls.idInsurancecompanies.markAsTouched();
  }

  save(): void {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const fleetId = (this.resolveFleetId() ?? '').trim();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const raw = this.form.getRawValue();
    const idVehicle = Number(raw.idVehicle);
    if (!Number.isFinite(idVehicle) || idVehicle <= 0) {
      this.toast.error(this.translate.instant('maintenance.invalidVehicle'));
      return;
    }

    const payload: MaintenanceUpsertRequest = {
      id: this.maintenanceId() ?? undefined,
      fleetId,
      idVehicle,
      idBooking: this.optionalPositiveLong(raw.idBooking),
      idInsurancecompanies: this.optionalPositiveLong(raw.idInsurancecompanies),
      note: raw.note.trim() || null,
    };

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

  private loadMaintenance(id: string, fleetId?: string): void {
    this.initializing.set(true);
    this.maintenanceService.getById(id, fleetId ?? this.resolveFleetId()).subscribe({
      next: row => {
        this.form.patchValue({
          idVehicle: row.idVehicle,
          idBooking: row.idBooking,
          idInsurancecompanies: row.idInsurancecompanies,
          note: row.note ?? '',
        });
        this.initializing.set(false);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.loadOneFailed'));
        this.initializing.set(false);
      },
    });
  }

  private loadVehicles(fleetId?: string): void {
    this.loadingVehicle.set(true);
    this.vehicleService
      .getList({ fleetId })
      .pipe(
        catchError(() => of([] as MaintenanceVehicleOption[])),
        finalize(() => this.loadingVehicle.set(false)),
      )
      .subscribe(vehicles => {
        this.vehicleOptions.set(this.toVehicleOptions(vehicles));
        this.applyVehicleFromQuery();
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

  private optionalPositiveLong(value: number | null | undefined): number | null {
    if (value == null || !Number.isFinite(Number(value)) || Number(value) <= 0) {
      return null;
    }
    return Number(value);
  }

  /** `?idVehicle=` from vehicle list → pre-select on create. */
  private applyVehicleFromQuery(): void {
    if (this.isEdit()) {
      return;
    }
    const raw = this.route.snapshot.queryParamMap.get('idVehicle');
    if (!raw) {
      return;
    }
    const idVehicle = Number(raw);
    if (!Number.isFinite(idVehicle) || idVehicle <= 0) {
      return;
    }
    this.form.patchValue({ idVehicle });
  }

  /** Prefer fleet from list row (query) so edit matches `GetMaintenanceByIdQuery`. */
  private resolveFleetId(): string | null {
    const fromRoute = this.route.snapshot.queryParamMap.get('fleetId')?.trim();
    if (fromRoute) {
      return fromRoute;
    }
    return this.authState.fleetId();
  }
}
