import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import {
  CountingNumberOutOfRangeError,
  countingNumberByTypeValidator,
  getCountingAccountTypeRange,
} from '../../../common/counting-account-ranges';
import { CreateCountingEntryRequest } from '../../../models/counting/counting-entry.model';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-counting-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './counting-entry-form.component.html',
})
export class CountingEntryFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private countingService = inject(CountingEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);

  readonly selectedCodeRange = computed(() =>
    getCountingAccountTypeRange(this.form.controls.countingType.value),
  );

  form = this.fb.group(
    {
      countingNumber: [0, [Validators.required, Validators.min(0)]],
      countingMain: [0, [Validators.required, Validators.min(0)]],
      countingType: [1, [Validators.required, Validators.min(1)]],
      reportNumber: [1, [Validators.required, Validators.min(1)]],
      countingLevel: [1, [Validators.required, Validators.min(1)]],
      balannce: [0, [Validators.required]],
      nameAr: ['', [Validators.required, Validators.maxLength(255)]],
      nameEn: ['', [Validators.maxLength(255)]],
      fleetId: ['', [Validators.required]],
    },
    { validators: countingNumberByTypeValidator() },
  );

  ngOnInit(): void {
    this.form.controls.fleetId.setValue(this.authState.fleetId() ?? '');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      if (this.countingNumberRangeError()) {
        this.toast.error(this.countingNumberRangeMessage());
      }
      return;
    }

    const raw = this.form.getRawValue();
    const body: CreateCountingEntryRequest = {
      countingNumber: raw.countingNumber,
      countingMain: raw.countingMain,
      countingType: raw.countingType,
      reportNumber: raw.reportNumber,
      countingLevel: raw.countingLevel,
      debtir: 0,
      credit: 0,
      balannce: raw.balannce,
      nameAr: raw.nameAr.trim(),
      nameEn: raw.nameEn.trim() || undefined,
      fleetId: raw.fleetId.trim(),
    };

    this.loading.set(true);
    this.countingService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Counting entry created successfully'));
        this.router.navigate(['/counting']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save counting entry'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  isCountingNumberRangeInvalid(): boolean {
    return Boolean(
      this.countingNumberRangeError() &&
      (this.form.controls.countingNumber.touched || this.form.controls.countingType.touched),
    );
  }

  countingNumberRangeMessage(): string {
    const rangeError = this.countingNumberRangeError();
    if (!rangeError) {
      return '';
    }

    const typeLabel = this.translate.instant(rangeError.typeLabelKey);
    return this.translate.instant(
      'Account number must be between {{min}} and {{max}} for {{type}}.',
      {
        min: rangeError.min,
        max: rangeError.max,
        type: typeLabel,
      },
    );
  }

  private countingNumberRangeError(): CountingNumberOutOfRangeError | null {
    return (
      (this.form.errors?.['countingNumberOutOfRange'] as CountingNumberOutOfRangeError) ?? null
    );
  }
}
