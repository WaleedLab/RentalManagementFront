import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { forkJoin, merge } from 'rxjs';

import { PrivilegeTypeCreateRequest } from '../../../models';
import { PrivilegeService } from '../../../services/privileges/privilege.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../../shared/services/toast.service';
import { coerceFormNumber, requiredNumber } from '../../../../../shared/validators/required-number.validator';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-privilege-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, FormsModule, RouterLink, TranslateModule, ...SHARED_FORM_FIELD_DIRECTIVES],
  templateUrl: './privilege-form.component.html',
  styleUrl: './privilege-form.component.scss',
})
export class PrivilegeFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{2,255}$/;
  private static readonly PRIVILEGE_CODE_REGEX = /^[A-Z0-9_]{3,500}$/;
  private static readonly SINGLE_WORKFLOW_SECTION_IDS = [
    'privilege-form-section-identity',
    'privilege-form-section-security',
  ] as const;
  private static readonly BULK_WORKFLOW_SECTION_IDS = ['privilege-form-section-batch'] as const;

  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private privilegeService = inject(PrivilegeService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  isBulkMode = signal(false);
  privilegeId = signal<string | null>(null);
  initializing = signal(false);
  loading = signal(false);
  submitAttempted = signal(false);
  private formProgressTick = signal(0);

  form = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(PrivilegeFormComponent.ARABIC_NAME_REGEX)]],
    nameEn: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(PrivilegeFormComponent.ENGLISH_NAME_REGEX)]],
    privilegeName: ['', [Validators.required, Validators.maxLength(500), Validators.pattern(PrivilegeFormComponent.PRIVILEGE_CODE_REGEX)]],
    order: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
  });

  bulkForm = this.fb.group({
    items: this.fb.array([this.createBulkRow(1)]),
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const controls = this.form.controls;
    return controls.name.valid && controls.nameEn.valid;
  });

  securitySectionComplete = computed(() => {
    this.formProgressTick();
    const controls = this.form.controls;
    return (
      this.identitySectionComplete() &&
      controls.privilegeName.valid &&
      controls.order.valid
    );
  });

  bulkSectionComplete = computed(() => {
    this.formProgressTick();
    return this.bulkItems.length > 0 && this.bulkForm.valid;
  });

  bulkRowCount = computed(() => this.bulkItems.length);

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    if (this.isBulkMode() && !this.isEdit()) {
      return this.bulkSectionComplete() ? 100 : 0;
    }

    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.securitySectionComplete()) done++;
    return Math.round((done / 2) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (this.isBulkMode() && !this.isEdit()) {
      return this.bulkSectionComplete() ? 2 : 1;
    }

    if (!this.identitySectionComplete()) return 1;
    if (!this.securitySectionComplete()) return 2;
    return 3;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    merge(this.bulkForm.valueChanges, this.bulkForm.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const id = this.route.snapshot.paramMap.get('id');
    const mode = (this.route.snapshot.queryParamMap.get('mode') || '').toLowerCase();
    if (!id) {
      this.isBulkMode.set(mode === 'bulk');
      return;
    }

    this.isEdit.set(true);
    this.isBulkMode.set(false);
    this.privilegeId.set(id);
    this.initializing.set(true);
    this.privilegeService.getById(id).subscribe({
      next: privilege => {
        this.form.patchValue({
          name: privilege.name || '',
          nameEn: privilege.nameEn || '',
          privilegeName: privilege.privilegeName || '',
          order: privilege.order ?? 0,
        });
      },
      error: () => this.toast.error(this.translate.instant('Failed to load privilege')),
      complete: () => this.initializing.set(false),
    });
  }

  get bulkItems(): FormArray {
    return this.bulkForm.controls.items;
  }

  setMode(mode: 'single' | 'bulk'): void {
    if (this.isEdit()) {
      return;
    }

    this.isBulkMode.set(mode === 'bulk');
    this.submitAttempted.set(false);
  }

  focusWorkflowSection(step: 1 | 2): void {
    const sectionIds =
      this.isBulkMode() && !this.isEdit()
        ? PrivilegeFormComponent.BULK_WORKFLOW_SECTION_IDS
        : PrivilegeFormComponent.SINGLE_WORKFLOW_SECTION_IDS;
    const sectionId = sectionIds[step - 1];
    if (!sectionId) {
      return;
    }

    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('privilege-form-section--focus');
    window.setTimeout(() => section.classList.remove('privilege-form-section--focus'), 1400);
  }

  hasError(controlName: 'name' | 'nameEn' | 'privilegeName' | 'order'): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  hasBulkRowError(index: number, controlName: 'name' | 'nameEn' | 'privilegeName' | 'order'): boolean {
    const row = this.bulkItems.at(index);
    if (!row) {
      return false;
    }

    const control = row.get(controlName);
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  addBulkRow(): void {
    this.bulkItems.push(this.createBulkRow(this.nextBulkOrder()));
  }

  cloneBulkRow(index: number): void {
    const row = this.bulkItems.at(index);
    if (!row) {
      return;
    }

    const raw = row.getRawValue();
    this.bulkItems.push(
      this.createBulkRow(this.nextBulkOrder(), raw.name, raw.nameEn, raw.privilegeName),
    );
  }

  removeBulkRow(index: number): void {
    if (this.bulkItems.length <= 1) {
      this.bulkItems.at(0).reset({
        name: '',
        nameEn: '',
        privilegeName: '',
        order: 1,
      });
      return;
    }

    this.bulkItems.removeAt(index);
  }

  autoFillCode(index?: number): void {
    if (index === undefined) {
      const sourceName = String(this.form.controls.nameEn.value ?? '');
      const suggestedCode = this.suggestPrivilegeCode(sourceName);
      if (suggestedCode) {
        this.form.controls.privilegeName.setValue(suggestedCode);
        this.form.controls.privilegeName.markAsDirty();
      }
      return;
    }

    const row = this.bulkItems.at(index);
    if (!row) {
      return;
    }

    const sourceName = String(row.get('nameEn')?.value ?? '');
    const suggestedCode = this.suggestPrivilegeCode(sourceName);
    if (suggestedCode) {
      row.get('privilegeName')?.setValue(suggestedCode);
    }
  }

  save(): void {
    this.submitAttempted.set(true);
    if (this.isBulkMode() && !this.isEdit()) {
      this.saveBulk();
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const body: PrivilegeTypeCreateRequest = {
      name: raw.name.trim(),
      nameEn: raw.nameEn.trim(),
      privilegeName: raw.privilegeName.trim(),
      order: coerceFormNumber(raw.order),
    };

    this.loading.set(true);
    const request$ = this.privilegeId()
      ? this.privilegeService.update({ ...body, id: this.privilegeId()! })
      : this.privilegeService.create(body);

    request$.subscribe({
      next: () => {
        this.toast.success(this.translate.instant(this.isEdit() ? 'Privilege updated' : 'Privilege created'));
        this.router.navigate(['/privileges']);
      },
      error: () => this.loading.set(false),
      complete: () => this.loading.set(false),
    });
  }

  private saveBulk(): void {
    if (this.bulkForm.invalid) {
      this.bulkForm.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const payload = this.bulkItems.controls.map(control => {
      const raw = control.getRawValue();
      return {
        name: String(raw.name ?? '').trim(),
        nameEn: String(raw.nameEn ?? '').trim(),
        privilegeName: String(raw.privilegeName ?? '').trim().toUpperCase(),
        order: coerceFormNumber(raw.order),
      };
    });

    const duplicates = this.findDuplicateCodes(payload.map(item => item.privilegeName));
    if (duplicates.length > 0) {
      this.toast.error(
        this.translate.instant('Duplicate privilege codes in batch') + `: ${duplicates.join(', ')}`,
      );
      return;
    }

    this.loading.set(true);
    forkJoin(payload.map(item => this.privilegeService.create(item))).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Privileges created') + ` (${payload.length})`);
        this.router.navigate(['/privileges']);
      },
      error: () => {
        this.toast.error(this.translate.instant('Failed to create privileges batch'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private createBulkRow(
    order: number,
    name: string = '',
    nameEn: string = '',
    privilegeName: string = '',
  ): FormGroup {
    return this.fb.group({
      name: [
        name,
        [
          Validators.required,
          Validators.maxLength(255),
          Validators.pattern(PrivilegeFormComponent.ARABIC_NAME_REGEX),
        ],
      ],
      nameEn: [
        nameEn,
        [
          Validators.required,
          Validators.maxLength(255),
          Validators.pattern(PrivilegeFormComponent.ENGLISH_NAME_REGEX),
        ],
      ],
      privilegeName: [
        privilegeName,
        [
          Validators.required,
          Validators.maxLength(500),
          Validators.pattern(PrivilegeFormComponent.PRIVILEGE_CODE_REGEX),
        ],
      ],
      order: this.nullableFb.control<number | null>(order, [requiredNumber({ min: 0 })]),
    });
  }

  private nextBulkOrder(): number {
    const lastOrder = this.bulkItems.controls
      .map(control => Number(control.get('order')?.value ?? 0))
      .reduce((maxOrder, currentOrder) => Math.max(maxOrder, currentOrder), 0);

    return lastOrder + 1;
  }

  private findDuplicateCodes(codes: string[]): string[] {
    const counts = new Map<string, number>();
    for (const code of codes) {
      const normalized = code.trim().toUpperCase();
      counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([code]) => code);
  }

  private suggestPrivilegeCode(sourceName: string): string {
    return sourceName
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }
}
