import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SHARED_FORM_FIELD_DIRECTIVES } from '../../../../../shared/forms/shared-form-field.imports';
import { coerceFormNumber, requiredNumber } from '../../../../../shared/validators/required-number.validator';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { CategoryVehicleUpsertRequest } from '../../../models';
import { CategoryVehicleService } from '../../../services/category-vehicles/category-vehicle.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-category-vehicle-form',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    ...SHARED_FORM_FIELD_DIRECTIVES,
    PageHeaderComponent,
  ],
  templateUrl: './category-vehicle-form.component.html',
  styleUrl: './category-vehicle-form.component.scss',
})
export class CategoryVehicleFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF0-9\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z0-9\s.'-]{0,255}$/;

  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private authState = inject(AuthStateService);
  private categoryVehicleService = inject(CategoryVehicleService);
  private toast = inject(ToastService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  categoryId = signal<string | null>(null);
  loading = signal(false);
  private categoryFleetId = signal<string>('');

  form = this.fb.group({
    nameAr: ['', [Validators.required, Validators.maxLength(255), Validators.pattern(CategoryVehicleFormComponent.ARABIC_NAME_REGEX)]],
    nameEn: ['', [Validators.maxLength(255), Validators.pattern(CategoryVehicleFormComponent.ENGLISH_NAME_REGEX)]],
    price_day_low: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    price_day_high: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    price_month_low: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    price_month_high: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceHoureExtraLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    priceHoureExtraHigh: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    countKMExtraLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    countKMExtraHigh: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    allowToLow: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
    allowToHigh: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
  });

  ngOnInit(): void {
    const fleetIdFromAuth = (this.authState.fleetId() ?? '').trim();
    if (fleetIdFromAuth) {
      this.categoryFleetId.set(fleetIdFromAuth);
    }

    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    this.isEdit.set(true);
    this.categoryId.set(id);
    this.loadCategory(id);
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






