import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../../shared/services/toast.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import type { Branch, BranchUpsertRequest } from '../../../models';
import { BranchService } from '../../../services/branches/branch.service';

@Component({
  selector: 'app-branch-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, ...SHARED_FORM_FIELD_DIRECTIVES],
  templateUrl: './branch-form.component.html',
  styleUrl: './branch-form.component.scss',
})
export class BranchFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF0-9\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z0-9\s.'-]{0,255}$/;
  private static readonly BRANCH_CODE_REGEX = /^[A-Za-z0-9-_]{0,100}$/;
  private static readonly CONTACT_NUMBER_REGEX = /^(?:\+?[0-9]\s?[-()]?){7,20}$/;

  private static readonly WORKFLOW_SECTION_IDS = [
    'branch-form-section-identity',
    'branch-form-section-location',
    'branch-form-section-contact',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private branchApi = inject(BranchService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  loading = signal(false);
  branchId = signal<number | null>(null);
  fleetId = signal<string>('');
  private formProgressTick = signal(0);

  form = this.fb.group({
    nameAr: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(BranchFormComponent.ARABIC_NAME_REGEX)]],
    nameEn: ['', [Validators.maxLength(255), Validators.pattern(BranchFormComponent.ENGLISH_NAME_REGEX)]],
    code: ['', [Validators.maxLength(100), Validators.pattern(BranchFormComponent.BRANCH_CODE_REGEX)]],
    street: ['', [Validators.maxLength(250)]],
    neighborHood: ['', [Validators.maxLength(150)]],
    buldingNumber: ['', [Validators.maxLength(100)]],
    city: ['', [Validators.maxLength(150)]],
    contactNumber: ['', [Validators.maxLength(50), Validators.pattern(BranchFormComponent.CONTACT_NUMBER_REGEX)]],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.nameAr.valid && f.nameEn.valid && f.code.valid;
  });

  locationSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.city.valid && f.neighborHood.valid && f.street.valid && f.buldingNumber.valid;
  });

  contactSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.contactNumber.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.locationSectionComplete()) done++;
    if (this.contactSectionComplete()) done++;
    return Math.round((done / 3) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.locationSectionComplete()) return 2;
    if (!this.contactSectionComplete()) return 3;
    return 4;
  });

  ngOnInit(): void {
    const fleet = this.authState.fleetId() ?? '';
    if (fleet) {
      this.fleetId.set(fleet);
    }

    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const idRaw = this.route.snapshot.paramMap.get('id');
    if (!idRaw) return;

    const id = Number(idRaw);
    if (!Number.isFinite(id)) return;
    this.isEdit.set(true);
    this.branchId.set(id);
    this.loadBranch(id);
  }

  focusWorkflowSection(step: 1 | 2 | 3): void {
    const sectionId = BranchFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('branch-form-section--focus');
    window.setTimeout(() => section.classList.remove('branch-form-section--focus'), 1400);
  }

  private loadBranch(id: number): void {
    const fleetId = this.resolveFleetId();

    this.loading.set(true);
    this.branchApi.getById(id, fleetId).subscribe({
      next: (branch: Branch) => {
        if (branch.fleetId?.trim()) {
          this.fleetId.set(branch.fleetId.trim());
        }

        this.form.patchValue({
          nameAr: branch.nameAr ?? '',
          nameEn: branch.nameEn ?? '',
          code: branch.code ?? '',
          street: branch.street ?? '',
          neighborHood: branch.neighborHood ?? '',
          buldingNumber: branch.buldingNumber ?? '',
          city: branch.city ?? '',
          contactNumber: branch.contactNumber ?? '',
        });
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load branch'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const fleetId = this.resolveFleetId();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const body: BranchUpsertRequest = {
      id: this.branchId() ?? undefined,
      fleetId,
      nameAr: raw.nameAr.trim(),
      nameEn: raw.nameEn.trim() || undefined,
      code: raw.code.trim() || undefined,
      street: raw.street.trim() || undefined,
      neighborHood: raw.neighborHood.trim() || undefined,
      buldingNumber: raw.buldingNumber.trim() || undefined,
      city: raw.city.trim() || undefined,
      contactNumber: raw.contactNumber.trim() || undefined,
      isActive: true,
    };

    this.loading.set(true);
    const branchId = this.branchId();
    const request$ = branchId ? this.branchApi.update(branchId, body) : this.branchApi.create(body);

    request$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(branchId ? 'Branch updated successfully' : 'Branch created successfully'),
        );
        this.router.navigate(['/branches']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save branch'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private resolveFleetId(): string | undefined {
    return this.fleetId().trim() || undefined;
  }
}
