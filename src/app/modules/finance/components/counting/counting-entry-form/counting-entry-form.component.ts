import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { CreateCountingEntryRequest } from '../../../models/counting/counting-entry.model';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';

@Component({
  selector: 'app-counting-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './counting-entry-form.component.html',
})
export class CountingEntryFormComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private countingService = inject(CountingEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);

  form = this.fb.group({
    countingNumber: [0, [Validators.required, Validators.min(0)]],
    countingMain: [0, [Validators.required, Validators.min(0)]],
    countingType: [0, [Validators.required, Validators.min(0)]],
    reportNumber: [0, [Validators.required, Validators.min(0)]],
    countingLevel: [0, [Validators.required, Validators.min(0)]],
    balannce: [0, [Validators.required]],
    nameAr: ['', [Validators.required, Validators.maxLength(255)]],
    nameEn: ['', [Validators.maxLength(255)]],
    fleetId: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.form.controls.fleetId.setValue(this.authState.fleetId() ?? '');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const raw = this.form.getRawValue();
    const body: CreateCountingEntryRequest = {
      countingNumber: raw.countingNumber,
      countingMain: raw.countingMain,
      countingType: raw.countingType,
      reportNumber: raw.reportNumber,
      countingLevel: raw.countingLevel,
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
}
