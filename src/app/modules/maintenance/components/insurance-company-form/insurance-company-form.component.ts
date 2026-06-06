import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { AuthStateService } from '../../../../core/auth/auth-state.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../shared/utils/focus-first-invalid-control.util';
import {
  optionalMobileNumberValidators,
  sanitizeMobileDigits,
} from '../../../../shared/utils/mobile-number.util';
import { InsuranceCompanyUpsertRequest } from '../../models/insurance-company.model';
import { InsuranceCompanyService } from '../../services/insurance-company.service';

@Component({
  selector: 'app-insurance-company-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
  ],
  templateUrl: './insurance-company-form.component.html',
  styleUrl: './insurance-company-form.component.scss',
})
export class InsuranceCompanyFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'insurance-company-form-section-identity',
    'insurance-company-form-section-contact',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private insuranceService = inject(InsuranceCompanyService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  insuranceId = signal<string | null>(null);
  initializing = signal(true);
  saving = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    address: ['', [Validators.maxLength(500)]],
    phoneNumber: ['', optionalMobileNumberValidators()],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.name.valid;
  });

  contactSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return this.identitySectionComplete() && f.phoneNumber.valid && f.address.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.contactSectionComplete()) done++;
    return Math.round((done / 2) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.contactSectionComplete()) return 2;
    return 3;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.initializing.set(false);
      return;
    }

    this.isEdit.set(true);
    this.insuranceId.set(id);
    this.insuranceService.getById(id, this.authState.fleetId()).subscribe({
      next: row => {
        this.form.patchValue({
          name: row.name ?? '',
          address: row.address ?? '',
          phoneNumber: sanitizeMobileDigits(row.phoneNumber ?? ''),
        });
        this.initializing.set(false);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.insurance.loadOneFailed'));
        this.initializing.set(false);
      },
    });
  }

  focusWorkflowSection(step: 1 | 2): void {
    const sectionId = InsuranceCompanyFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('insurance-company-form-section--focus');
    window.setTimeout(() => section.classList.remove('insurance-company-form-section--focus'), 1400);
  }

  hasError(controlName: 'name' | 'phoneNumber'): boolean {
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
    const payload: InsuranceCompanyUpsertRequest = {
      id: this.insuranceId() ?? undefined,
      fleetId,
      name: raw.name.trim(),
      address: raw.address.trim() || null,
      phoneNumber: sanitizeMobileDigits(raw.phoneNumber.trim()) || null,
    };

    this.saving.set(true);
    const req$ = this.isEdit()
      ? this.insuranceService.update(payload)
      : this.insuranceService.create(payload);
    req$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(
            this.isEdit() ? 'maintenance.insurance.updated' : 'maintenance.insurance.created',
          ),
        );
        this.router.navigate(['/maintenance/insurance-companies']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.insurance.saveFailed'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
