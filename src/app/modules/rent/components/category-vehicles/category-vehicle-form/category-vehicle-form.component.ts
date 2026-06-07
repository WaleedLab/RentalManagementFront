import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import { ToastService } from '../../../../../shared/services/toast.service';
import { greaterThanField } from '../../../../../shared/validators/greater-than-field.validator';
import { coerceFormNumber, requiredNumber } from '../../../../../shared/validators/required-number.validator';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { CategoryVehicleUpsertRequest } from '../../../models';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';

@Component({
  selector: 'app-category-vehicle-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, ...SHARED_FORM_FIELD_DIRECTIVES],
  templateUrl: './category-vehicle-form.component.html',
  styleUrl: './category-vehicle-form.component.scss',
})
export class CategoryVehicleFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF0-9\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z0-9\s.'-]{0,255}$/;

  private static readonly WORKFLOW_SECTION_IDS = [
    'category-form-section-identity',
    'category-form-section-period-pricing',
    'category-form-section-extra-pricing',
    'category-form-section-limits',
  ] as const;

  private static readonly HIGH_LOW_FIELD_PAIRS = [
    ['price_day_low', 'price_day_high'],
    ['price_month_low', 'price_month_high'],
    ['priceHoureExtraLow', 'priceHoureExtraHigh'],
    ['countKMExtraLow', 'countKMExtraHigh'],
    ['allowToLow', 'allowToHigh'],
  ] as const;

  private static readonly HIGH_FIELD_TO_LOW: Record<
    | 'price_day_high'
    | 'price_month_high'
    | 'priceHoureExtraHigh'
    | 'countKMExtraHigh'
    | 'allowToHigh',
    string
  > = {
    price_day_high: 'price_day_low',
    price_month_high: 'price_month_low',
    priceHoureExtraHigh: 'priceHoureExtraLow',
    countKMExtraHigh: 'countKMExtraLow',
    allowToHigh: 'allowToLow',
  };

  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private authState = inject(AuthStateService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  categoryId = signal<string | null>(null);
  loading = signal(false);
  private categoryFleetId = signal<string>('');
  private formProgressTick = signal(0);

  form = this.fb.group({
    nameAr: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(CategoryVehicleFormComponent.ARABIC_NAME_REGEX)]],
    nameEn: ['', [Validators.maxLength(255), Validators.pattern(CategoryVehicleFormComponent.ENGLISH_NAME_REGEX)]],
    price_day_low: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    price_day_high: this.nullableFb.control<number | null>(null, [
      requiredNumber({ min: 0 }),
      greaterThanField('price_day_low'),
    ]),
    price_month_low: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    price_month_high: this.nullableFb.control<number | null>(null, [
      requiredNumber({ min: 0 }),
      greaterThanField('price_month_low'),
    ]),
    priceHoureExtraLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceHoureExtraHigh: this.nullableFb.control<number | null>(null, [
      requiredNumber({ min: 0 }),
      greaterThanField('priceHoureExtraLow'),
    ]),
    countKMExtraLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    countKMExtraHigh: this.nullableFb.control<number | null>(null, [
      requiredNumber({ min: 0 }),
      greaterThanField('countKMExtraLow'),
    ]),
    allowToLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    allowToHigh: this.nullableFb.control<number | null>(null, [
      requiredNumber({ min: 0 }),
      greaterThanField('allowToLow'),
    ]),
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.nameAr.valid && f.nameEn.valid;
  });

  periodPricingSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return (
      f.price_day_low.valid &&
      f.price_day_high.valid &&
      f.price_month_low.valid &&
      f.price_month_high.valid
    );
  });

  extraPricingSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return (
      f.priceHoureExtraLow.valid &&
      f.priceHoureExtraHigh.valid &&
      f.countKMExtraLow.valid &&
      f.countKMExtraHigh.valid
    );
  });

  limitsSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.allowToLow.valid && f.allowToHigh.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.periodPricingSectionComplete()) done++;
    if (this.extraPricingSectionComplete()) done++;
    if (this.limitsSectionComplete()) done++;
    return Math.round((done / 4) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.periodPricingSectionComplete()) return 2;
    if (!this.extraPricingSectionComplete()) return 3;
    if (!this.limitsSectionComplete()) return 4;
    return 5;
  });

  ngOnInit(): void {
    const fleetIdFromAuth = (this.authState.fleetId() ?? '').trim();
    if (fleetIdFromAuth) {
      this.categoryFleetId.set(fleetIdFromAuth);
    }

    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    this.setupHighLowValidation();

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isEdit.set(true);
    this.categoryId.set(id);
    this.loadCategory(id);
  }

  showHighMustExceedLow(
    controlName:
      | 'price_day_high'
      | 'price_month_high'
      | 'priceHoureExtraHigh'
      | 'countKMExtraHigh'
      | 'allowToHigh',
  ): boolean {
    const high = this.form.controls[controlName];
    if (!high.hasError('greaterThanLow')) {
      return false;
    }

    const lowName = CategoryVehicleFormComponent.HIGH_FIELD_TO_LOW[controlName];
    const low = this.form.get(lowName);
    return !!(high.touched || high.dirty || low?.touched || low?.dirty);
  }

  private setupHighLowValidation(): void {
    for (const [lowField, highField] of CategoryVehicleFormComponent.HIGH_LOW_FIELD_PAIRS) {
      this.form
        .get(lowField)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.revalidateHighField(highField, true));

      this.form
        .get(highField)
        ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.revalidateHighField(highField, false));
    }
  }

  private revalidateHighField(highField: string, fromLowChange: boolean): void {
    const highCtrl = this.form.get(highField);
    highCtrl?.updateValueAndValidity({ emitEvent: false });

    if (fromLowChange && highCtrl?.hasError('greaterThanLow')) {
      highCtrl.markAsTouched({ onlySelf: true });
      highCtrl.markAsDirty({ onlySelf: true });
    }

    this.formProgressTick.update(v => v + 1);
  }

  private revalidateAllHighFields(): void {
    for (const [, highField] of CategoryVehicleFormComponent.HIGH_LOW_FIELD_PAIRS) {
      this.revalidateHighField(highField, false);
    }
  }

  focusWorkflowSection(step: 1 | 2 | 3 | 4): void {
    const sectionId = CategoryVehicleFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('category-form-section--focus');
    window.setTimeout(() => section.classList.remove('category-form-section--focus'), 1400);
  }

  private loadCategory(id: string): void {
    this.loading.set(true);
    this.categoryVehicleService.getById(id, this.resolveFleetId() ?? undefined).subscribe({
      next: category => {
        const fleetIdFromCategory = (category.fleetId ?? '').trim();
        if (fleetIdFromCategory) {
          this.categoryFleetId.set(fleetIdFromCategory);
        }

        this.form.patchValue({
          nameAr: category.nameAr,
          nameEn: category.nameEn || '',
          price_day_low: category.price_day_low ?? 0,
          price_day_high: category.price_day_high ?? 0,
          price_month_low: category.price_month_low ?? 0,
          price_month_high: category.price_month_high ?? 0,
          priceHoureExtraLow: category.priceHoureExtraLow ?? 0,
          priceHoureExtraHigh: category.priceHoureExtraHigh ?? 0,
          countKMExtraLow: category.countKMExtraLow ?? 0,
          countKMExtraHigh: category.countKMExtraHigh ?? 0,
          allowToLow: category.allowToLow ?? 0,
          allowToHigh: category.allowToHigh ?? 0,
        });
        this.revalidateAllHighFields();
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to load vehicle category'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const fleetId = this.resolveFleetId();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CategoryVehicleUpsertRequest = {
      id: this.categoryId() ?? undefined,
      fleetId,
      nameAr: raw.nameAr.trim(),
      nameEn: raw.nameEn.trim() || undefined,
      price_day_low: coerceFormNumber(raw.price_day_low),
      price_day_high: coerceFormNumber(raw.price_day_high),
      price_month_low: coerceFormNumber(raw.price_month_low),
      price_month_high: coerceFormNumber(raw.price_month_high),
      priceHoureExtraLow: coerceFormNumber(raw.priceHoureExtraLow),
      priceHoureExtraHigh: coerceFormNumber(raw.priceHoureExtraHigh),
      countKMExtraLow: coerceFormNumber(raw.countKMExtraLow),
      countKMExtraHigh: coerceFormNumber(raw.countKMExtraHigh),
      allowToLow: coerceFormNumber(raw.allowToLow),
      allowToHigh: coerceFormNumber(raw.allowToHigh),
    };

    this.loading.set(true);
    const request$ = this.isEdit()
      ? this.categoryVehicleService.update(payload)
      : this.categoryVehicleService.create(payload);

    request$.subscribe({
      next: () => {
        this.toast.success(this.translate.instant(this.isEdit() ? 'Vehicle category updated' : 'Vehicle category created'));
        this.router.navigate(['/category-vehicles']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save vehicle category'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private resolveFleetId(): string | null {
    const fleetIdFromAuth = (this.authState.fleetId() ?? '').trim();
    if (fleetIdFromAuth) {
      return fleetIdFromAuth;
    }

    const fleetIdFromCategory = this.categoryFleetId().trim();
    return fleetIdFromCategory || null;
  }
}
