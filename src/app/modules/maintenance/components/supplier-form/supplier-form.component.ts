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
  mobileNumberValidators,
  optionalMobileNumberValidators,
  sanitizeMobileDigits,
} from '../../../../shared/utils/mobile-number.util';
import { SupplierUpsertRequest } from '../../models/supplier.model';
import { SupplierService } from '../../services/supplier.service';

@Component({
  selector: 'app-supplier-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
  ],
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.scss',
})
export class SupplierFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'supplier-form-section-identity',
    'supplier-form-section-contact',
    'supplier-form-section-accounting',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private supplierService = inject(SupplierService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  supplierId = signal<string | null>(null);
  initializing = signal(true);
  saving = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);

  form = this.fb.group({
    supplierName: ['', [Validators.required, Validators.maxLength(200)]],
    phone: ['', mobileNumberValidators({ required: true })],
    phone2: ['', optionalMobileNumberValidators()],
    address: ['', [Validators.maxLength(500)]],
    email: ['', [Validators.email, Validators.maxLength(200)]],
    taxRecord: ['', [Validators.maxLength(100)]],
    accountNumber: ['', [Validators.maxLength(100)]],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.supplierName.valid;
  });

  contactSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return (
      this.identitySectionComplete() &&
      f.phone.valid &&
      f.phone2.valid &&
      f.email.valid &&
      f.address.valid
    );
  });

  accountingSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return this.contactSectionComplete() && f.taxRecord.valid && f.accountNumber.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.contactSectionComplete()) done++;
    if (this.accountingSectionComplete()) done++;
    return Math.round((done / 3) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.contactSectionComplete()) return 2;
    if (!this.accountingSectionComplete()) return 3;
    return 4;
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
    this.supplierId.set(id);
    this.supplierService.getById(id, this.authState.fleetId()).subscribe({
      next: row => {
        this.form.patchValue({
          supplierName: row.supplierName ?? '',
          phone: sanitizeMobileDigits(row.phone ?? ''),
          phone2: sanitizeMobileDigits(row.phone2 ?? ''),
          address: row.address ?? '',
          email: row.email ?? '',
          taxRecord: row.taxRecord ?? '',
          accountNumber: row.accountNumber ?? '',
        });
        this.initializing.set(false);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.supplier.loadOneFailed'));
        this.initializing.set(false);
      },
    });
  }

  focusWorkflowSection(step: 1 | 2 | 3): void {
    const sectionId = SupplierFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('supplier-form-section--focus');
    window.setTimeout(() => section.classList.remove('supplier-form-section--focus'), 1400);
  }

  hasError(controlName: 'supplierName' | 'phone' | 'phone2' | 'email'): boolean {
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
    const payload: SupplierUpsertRequest = {
      id: this.supplierId() ?? undefined,
      fleetId,
      supplierName: raw.supplierName.trim(),
      phone: sanitizeMobileDigits(raw.phone.trim()),
      phone2: sanitizeMobileDigits(raw.phone2.trim()) || null,
      address: raw.address.trim() || null,
      email: raw.email.trim() || null,
      taxRecord: raw.taxRecord.trim() || null,
      accountNumber: raw.accountNumber.trim() || null,
    };

    this.saving.set(true);
    const req$ = this.isEdit()
      ? this.supplierService.update(payload)
      : this.supplierService.create(payload);
    req$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(
            this.isEdit() ? 'maintenance.supplier.updated' : 'maintenance.supplier.created',
          ),
        );
        this.router.navigate(['/maintenance/suppliers']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.supplier.saveFailed'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
