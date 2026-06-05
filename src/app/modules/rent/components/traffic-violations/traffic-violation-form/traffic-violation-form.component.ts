import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import { coerceFormNumber, requiredNumber } from '../../../../../shared/validators/required-number.validator';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { catchError, finalize, forkJoin, merge, of } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { ToastService } from '../../../../../shared/services/toast.service';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
  SmoothSelectValue,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { Vehicle } from '../../../models';
import { TrafficBooking } from '../../../models/booking/traffic-booking.model';
import { TrafficViolationUpsertRequest } from '../../../models/traffic-violations/traffic-violation.model';
import { BookingService } from '../../../services/booking/booking.service';
import { TrafficViolationService } from '../../../services/traffic-violations/traffic-violation.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';

@Component({
  selector: 'app-traffic-violation-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
    SmoothSelectComponent,
    DatePickerComponent,
  ],
  templateUrl: './traffic-violation-form.component.html',
  styleUrl: './traffic-violation-form.component.scss',
})
export class TrafficViolationFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'traffic-violation-form-section-identity',
    'traffic-violation-form-section-linking',
    'traffic-violation-form-section-details',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private authState = inject(AuthStateService);
  private trafficViolationService = inject(TrafficViolationService);
  private bookingService = inject(BookingService);
  private vehicleService = inject(VehicleService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  violationId = signal<string | null>(null);
  /** Reference data (bookings / vehicles) or loading one violation for edit */
  initializing = signal(true);
  saving = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);
  bookingOptions = signal<SmoothSelectOption[]>([]);
  vehicleOptions = signal<SmoothSelectOption[]>([]);
  /** Raw rows from `GetTrafficBookingsQuery` for resolving `idVehicle` after pick */
  bookings = signal<TrafficBooking[]>([]);
  /** Fleet/branch vehicles from `Vehicle/List` (same shape as `GetVehiclesQuery`). */
  vehicles = signal<Vehicle[]>([]);
  loadingVehicle = signal(false);

  form = this.fb.group({
    nameViolation: [''],
    idBooking: this.fb.control<number | null>(null),
    idVehicle: this.fb.control<number | null>(null, [Validators.required]),
    dateViolation: ['', [Validators.required]],
    violationFine: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    description: [''],
    numberViolation: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 1 })]),
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.numberViolation.valid;
  });

  linkingSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.idVehicle.valid;
  });

  detailsSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.dateViolation.valid && f.violationFine.valid && f.description.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.linkingSectionComplete()) done++;
    if (this.detailsSectionComplete()) done++;
    return Math.round((done / 3) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.linkingSectionComplete()) return 2;
    if (!this.detailsSectionComplete()) return 3;
    return 4;
  });

  get idBookingCtrl() {
    return this.form.controls.idBooking;
  }

  get idVehicleCtrl() {
    return this.form.controls.idVehicle;
  }

  onBookingChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    this.idBookingCtrl.setValue(Number.isFinite(next as number) ? (next as number) : null);
    this.idBookingCtrl.markAsTouched();

    if (next === null || !Number.isFinite(next)) {
      return;
    }

    const booking = this.bookings().find(b => b.id === next);
    if (!booking) {
      return;
    }

    const vehicleId = booking.idVehicle;
    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
      this.toast.error(this.translate.instant('trafficViolations.noVehicleOnBooking'));
      return;
    }

    this.applyVehicleFromFleetOrFetch(vehicleId);
  }

  onVehicleChange(value: SmoothSelectValue): void {
    const next = value === '' || value === null ? null : Number(value);
    const idV = Number.isFinite(next as number) && (next as number) > 0 ? (next as number) : null;
    this.idVehicleCtrl.setValue(idV);
    this.idVehicleCtrl.markAsTouched();

    if (idV === null) {
      return;
    }

    const row = this.vehicles().find(v => Number(v.id) === idV);
    if (row) {
      return;
    }

    this.loadVehicleById(idV, { silent: true });
  }

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const id = this.route.snapshot.paramMap.get('id');
    const fleetId = this.authState.fleetId() ?? undefined;
    const branchId = Number(this.authState.branchId() || 0) || 0;

    this.initializing.set(true);
    forkJoin({
      bookings: this.bookingService.getTrafficBookings({ fleetId, branchId }),
      vehicles: this.vehicleService
        .getListMergedAllStatuses({
          fleetId,
          branchId: branchId > 0 ? branchId : undefined,
        })
        .pipe(catchError(() => of([] as Vehicle[]))),
    }).subscribe({
      next: ({ bookings, vehicles }) => {
        const list = bookings ?? [];
        this.bookings.set(list);
        this.vehicles.set(vehicles ?? []);
        this.bookingOptions.set(this.buildBookingOptions(list));
        this.vehicleOptions.set(this.toVehicleOptions(vehicles ?? []));
        if (id) {
          this.isEdit.set(true);
          this.violationId.set(id);
          this.loadViolation(id);
        } else {
          this.initializing.set(false);
        }
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('trafficViolations.referenceLoadFailed'));
        this.initializing.set(false);
      },
    });
  }

  focusWorkflowSection(step: 1 | 2 | 3): void {
    const sectionId = TrafficViolationFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('traffic-violation-form-section--focus');
    window.setTimeout(() => section.classList.remove('traffic-violation-form-section--focus'), 1400);
  }

  hasError(controlName: 'numberViolation' | 'idVehicle' | 'dateViolation' | 'violationFine'): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  save(): void {
    this.submitAttempted.set(true);
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
    const idBookingRaw = raw.idBooking;
    const idBooking: number | null =
      idBookingRaw != null && Number.isFinite(Number(idBookingRaw)) && Number(idBookingRaw) > 0
        ? Number(idBookingRaw)
        : null;
    const idVehicle = Number(raw.idVehicle);
    if (!Number.isFinite(idVehicle) || idVehicle <= 0) {
      this.toast.error(this.translate.instant('trafficViolations.invalidVehicle'));
      return;
    }

    const dateIso = this.toApiDateTime(raw.dateViolation);
    const payload: TrafficViolationUpsertRequest = {
      id: this.violationId() ?? undefined,
      fleetId,
      nameViolation: raw.nameViolation.trim() || undefined,
      idBooking,
      idVehicle,
      dateViolation: dateIso,
      violationFine: coerceFormNumber(raw.violationFine),
      description: raw.description.trim() || undefined,
      numberViolation: coerceFormNumber(raw.numberViolation, 1),
    };

    this.saving.set(true);
    const req$ = this.isEdit()
      ? this.trafficViolationService.update(payload)
      : this.trafficViolationService.create(payload);

    req$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(this.isEdit() ? 'trafficViolations.updated' : 'trafficViolations.created'),
        );
        this.router.navigate(['/traffic-violations']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('trafficViolations.saveFailed'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }

  private loadViolation(id: string): void {
    this.trafficViolationService.getById(id, this.authState.fleetId()).subscribe({
      next: v => {
        this.form.patchValue({
          nameViolation: v.nameViolation ?? '',
          idBooking: v.idBooking != null && v.idBooking > 0 ? v.idBooking : null,
          idVehicle: v.idVehicle,
          dateViolation: this.toDatetimeLocalValue(v.dateViolation),
          violationFine: v.violationFine,
          description: v.description ?? '',
          numberViolation: v.numberViolation,
        });
        this.applyVehicleFromFleetOrFetch(v.idVehicle, {
          silent: true,
          after: () => {
            this.formProgressTick.update(v => v + 1);
            this.initializing.set(false);
          },
        });
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('trafficViolations.loadOneFailed'));
        this.initializing.set(false);
      },
    });
  }

  /**
   * Prefer fleet list (`Vehicle/List`); fall back to `Vehicle/{id}/{fleetId}` when missing.
   */
  private applyVehicleFromFleetOrFetch(
    vehicleId: number,
    opts?: { silent?: boolean; after?: () => void },
  ): void {
    const row = this.vehicles().find(vr => Number(vr.id) === vehicleId);
    if (row) {
      this.idVehicleCtrl.setValue(vehicleId);
      this.idVehicleCtrl.markAsTouched();
      opts?.after?.();
      return;
    }
    this.loadVehicleById(vehicleId, opts);
  }

  /**
   * Loads vehicle for display + `idVehicle` using `GetVehicleById` (`Vehicle/{id}/{fleetId}`).
   */
  private loadVehicleById(vehicleId: number, opts?: { silent?: boolean; after?: () => void }): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId?.trim()) {
      this.idVehicleCtrl.setValue(null);
      opts?.after?.();
      return;
    }

    if (!Number.isFinite(vehicleId) || vehicleId <= 0) {
      this.idVehicleCtrl.setValue(null);
      opts?.after?.();
      return;
    }

    this.loadingVehicle.set(true);
    this.vehicleService
      .getById(String(vehicleId), fleetId)
      .pipe(
        finalize(() => {
          this.loadingVehicle.set(false);
          opts?.after?.();
        }),
      )
      .subscribe({
        next: vehicle => {
          this.mergeVehicleIntoReferenceLists(vehicle);
          this.idVehicleCtrl.setValue(vehicleId);
          this.idVehicleCtrl.markAsTouched();
        },
        error: err => {
          this.idVehicleCtrl.setValue(null);
          if (!opts?.silent) {
            this.toast.error(err?.message ?? this.translate.instant('trafficViolations.vehicleLoadFailed'));
          }
        },
      });
  }

  private mergeVehicleIntoReferenceLists(vehicle: Vehicle): void {
    const idNum = Number(vehicle.id);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      return;
    }
    if (!this.vehicles().some(v => Number(v.id) === idNum)) {
      this.vehicles.update(rows => [...rows, vehicle]);
      this.vehicleOptions.update(opts => [...opts, { label: this.formatVehicleLabel(vehicle), value: idNum }]);
    }
  }

  private buildBookingOptions(bookings: TrafficBooking[]): SmoothSelectOption[] {
    const none: SmoothSelectOption = {
      label: this.translate.instant('trafficViolations.bookingNone'),
      value: '',
    };
    return [none, ...this.toBookingOptions(bookings)];
  }

  private toBookingOptions(bookings: TrafficBooking[]): SmoothSelectOption[] {
    return bookings.map(b => {
      const ref = (b.numberBookingINBasame || '').trim();
      const status = String(b.status ?? '').trim();
      const labelParts = [ref, status].filter(Boolean);
      const label = labelParts.length ? labelParts.join(' · ') : `#${b.id}`;
      return { label, value: b.id };
    });
  }

  private toVehicleOptions(vehicles: Vehicle[]): SmoothSelectOption[] {
    return vehicles
      .filter(v => {
        const n = Number(v.id);
        return Number.isFinite(n) && n > 0;
      })
      .map(v => ({
        label: this.formatVehicleLabel(v),
        value: Number(v.id),
      }));
  }

  private formatVehicleLabel(vehicle: Vehicle): string {
    const plate = vehicle.plateNumber?.trim() || '';
    const serial = vehicle.serialNumber?.trim() || '';
    const engine = vehicle.engine?.trim() || '';
    const name = [vehicle.make, vehicle.model].filter(Boolean).join(' ').trim();
    const tailParts = [serial, engine].filter(Boolean);
    const tail = tailParts.length ? tailParts.join(' ') : name;
    const main = [plate, tail].filter(Boolean).join(' — ');
    return main || String(vehicle.id);
  }

  /** `datetime-local` value from API date string */
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
}
