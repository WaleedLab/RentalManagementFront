import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { CreateCashAccountRequest } from '../../../models/cash/cash-account.model';
import { CashAccountService } from '../../../services/cash/cash-account.service';

@Component({
  selector: 'app-cash-account-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './cash-account-form.component.html',
})
export class CashAccountFormComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private cashService = inject(CashAccountService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);

  form = this.fb.group({
    countingId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(500)]],
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

    const createdBy = this.authState.currentUser()?.id;
    if (!createdBy) {
      this.toast.error(this.translate.instant('Current user is required'));
      return;
    }

    const raw = this.form.getRawValue();
    const body: CreateCashAccountRequest = {
      id: this.generateUuid(),
      countingId: raw.countingId.trim(),
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      createdBy,
      fleetId: raw.fleetId.trim(),
    };

    this.loading.set(true);
    this.cashService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Cash account created successfully'));
        this.router.navigate(['/cash']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save cash account'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  private generateUuid(): string {
    if (globalThis.crypto?.randomUUID) {
      return globalThis.crypto.randomUUID();
    }

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, char => {
      const rand = Math.random() * 16 | 0;
      const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    });
  }
}
