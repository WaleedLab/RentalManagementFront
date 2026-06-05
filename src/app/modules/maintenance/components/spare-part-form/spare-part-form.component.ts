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
import { SparePartUpsertRequest } from '../../models/spare-part.model';
import { SparePartService } from '../../services/spare-part.service';

@Component({
  selector: 'app-spare-part-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
  ],
  templateUrl: './spare-part-form.component.html',
  styleUrl: './spare-part-form.component.scss',
})
export class SparePartFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'spare-part-form-section-identity',
    'spare-part-form-section-description',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private sparePartService = inject(SparePartService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  sparePartId = signal<string | null>(null);
  initializing = signal(true);
  saving = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    number: [0, [Validators.required, Validators.min(0)]],
    description: ['', [Validators.maxLength(1000)]],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.name.valid && f.number.valid;
  });

  descriptionSectionComplete = computed(() => {
    this.formProgressTick();
    return this.identitySectionComplete() && this.form.controls.description.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.descriptionSectionComplete()) done++;
    return Math.round((done / 2) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.descriptionSectionComplete()) return 2;
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
    this.sparePartId.set(id);
    this.sparePartService.getById(id, this.authState.fleetId()).subscribe({
      next: row => {
        this.form.patchValue({
          name: row.name ?? '',
          number: row.number ?? 0,
          description: row.description ?? '',
        });
        this.initializing.set(false);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.sparePart.loadOneFailed'));
        this.initializing.set(false);
      },
    });
  }

  focusWorkflowSection(step: 1 | 2): void {
    const sectionId = SparePartFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('spare-part-form-section--focus');
    window.setTimeout(() => section.classList.remove('spare-part-form-section--focus'), 1400);
  }

  hasError(controlName: 'name' | 'number'): boolean {
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
    const payload: SparePartUpsertRequest = {
      id: this.sparePartId() ?? undefined,
      fleetId,
      name: raw.name.trim(),
      number: Number(raw.number) || 0,
      description: raw.description.trim() || null,
    };

    this.saving.set(true);
    const req$ = this.isEdit()
      ? this.sparePartService.update(payload)
      : this.sparePartService.create(payload);
    req$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(
            this.isEdit() ? 'maintenance.sparePart.updated' : 'maintenance.sparePart.created',
          ),
        );
        this.router.navigate(['/maintenance/spare-parts']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('maintenance.sparePart.saveFailed'));
        this.saving.set(false);
      },
      complete: () => this.saving.set(false),
    });
  }
}
