import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { CreateBankRequest } from '../../../models/banks/bank.model';
import { BankService } from '../../../services/banks/bank.service';

@Component({
  selector: 'app-bank-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './bank-form.component.html',
})
export class BankFormComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private bankService = inject(BankService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);

  form = this.fb.group({
    countingId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(500)]],
    code: ['', [Validators.maxLength(100)]],
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
    const body: CreateBankRequest = {
      countingId: raw.countingId.trim(),
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      code: raw.code.trim() || undefined,
      fleetId: raw.fleetId.trim(),
    };

    this.loading.set(true);
    this.bankService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Bank created successfully'));
        this.router.navigate(['/banks']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save bank'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
