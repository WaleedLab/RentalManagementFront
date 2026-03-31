import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { CreatePaymentCountRequest } from '../../../models/payment-counts/payment-count.model';
import { PaymentCountService } from '../../../services/payment-counts/payment-count.service';

@Component({
  selector: 'app-payment-count-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './payment-count-form.component.html',
})
export class PaymentCountFormComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private paymentCountService = inject(PaymentCountService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);

  form = this.fb.group({
    idCustomer: [0, [Validators.required, Validators.min(1)]],
    paid: [0, [Validators.required, Validators.min(0)]],
    dscription: ['', [Validators.required, Validators.maxLength(500)]],
    idVehicle: [0, [Validators.required, Validators.min(1)]],
    idBranch: [Number(this.authState.branchId() ?? 0), [Validators.required, Validators.min(1)]],
    paymentType: [1, [Validators.required, Validators.min(0)]],
    bondType: [1, [Validators.required, Validators.min(0)]],
    status: [1, [Validators.required, Validators.min(0)]],
    idCash: [''],
    idBank: [''],
    paidCash: [0, [Validators.required, Validators.min(0)]],
    paidBank: [0, [Validators.required, Validators.min(0)]],
    idBooking: [0, [Validators.required, Validators.min(1)]],
    stutusbooking: [0, [Validators.required, Validators.min(0)]],
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
    const body: CreatePaymentCountRequest = {
      idCustomer: raw.idCustomer,
      paid: raw.paid,
      dscription: raw.dscription.trim(),
      idVehicle: raw.idVehicle,
      idBranch: raw.idBranch,
      paymentType: raw.paymentType,
      bondType: raw.bondType,
      status: raw.status,
      idCash: raw.idCash.trim() || undefined,
      idBank: raw.idBank.trim() || undefined,
      paidCash: raw.paidCash,
      paidBank: raw.paidBank,
      idBooking: raw.idBooking,
      stutusbooking: raw.stutusbooking,
      fleetId: raw.fleetId.trim(),
    };

    this.loading.set(true);
    this.paymentCountService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Payment count created successfully'));
        this.router.navigate(['/payment-counts']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save payment count'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
