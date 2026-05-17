import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { DatePickerComponent } from '../../../../../shared/ui/date-picker/date-picker.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { CreateFinancialYearRequest } from '../../../models/financial-years/financial-year.model';
import { FinancialYearService } from '../../../services/financial-years/financial-year.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-financial-year-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent, DatePickerComponent],
  templateUrl: './financial-year-form.component.html',
})
export class FinancialYearFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private financialYearService = inject(FinancialYearService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);

  form = this.fb.group({
    financialYearNumber: [new Date().getFullYear(), [Validators.required, Validators.min(2000)]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    startDate: ['', [Validators.required]],
    endDate: ['', [Validators.required]],
    isCurrentYear: [false],
    fleetId: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.form.controls.fleetId.setValue(this.authState.fleetId() ?? '');
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const body: CreateFinancialYearRequest = {
      financialYearNumber: raw.financialYearNumber,
      name: raw.name.trim(),
      startDate: new Date(raw.startDate).toISOString(),
      endDate: new Date(raw.endDate).toISOString(),
      isCurrentYear: raw.isCurrentYear,
      fleetId: raw.fleetId.trim(),
    };

    this.loading.set(true);
    this.financialYearService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Financial year created successfully'));
        this.router.navigate(['/financial-years']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save financial year'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
