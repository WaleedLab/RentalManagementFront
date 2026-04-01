import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { CustomerSubscriptionUpsertRequest } from '../../../models/subscriptions/customer-subscription.model';
import { CustomerSubscriptionService } from '../../../services/subscriptions/customer-subscription.service';

@Component({
  selector: 'app-customer-subscription-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './customer-subscription-form.component.html',
})
export class CustomerSubscriptionFormComponent implements OnInit {
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{2,255}$/;

  private fb = inject(NonNullableFormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private subscriptionService = inject(CustomerSubscriptionService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);

  isEdit = signal(false);
  loading = signal(false);
  subscriptionId = signal<number | null>(null);

  form = this.fb.group({
    nameAr: [
      '',
      [
        Validators.required,
        Validators.maxLength(255),
        Validators.pattern(CustomerSubscriptionFormComponent.ARABIC_NAME_REGEX),
      ],
    ],
    nameEn: [
      '',
      [
        Validators.required,
        Validators.maxLength(255),
        Validators.pattern(CustomerSubscriptionFormComponent.ENGLISH_NAME_REGEX),
      ],
    ],
    description: ['', [Validators.maxLength(500)]],
    discount: [0, [Validators.required, Validators.min(0), Validators.max(100)]],
    subscriptionApprovedAfter: [0, [Validators.required, Validators.min(0)]],
    isOld: [false],
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id') || 0);
    if (!id) {
      return;
    }

    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    this.isEdit.set(true);
    this.subscriptionId.set(id);
    this.loading.set(true);
    this.subscriptionService.getById(id, fleetId).subscribe({
      next: subscription => {
        this.form.patchValue({
          nameAr: subscription.nameAr,
          nameEn: subscription.nameEn || '',
          description: subscription.description || '',
          discount: subscription.discount ?? 0,
          subscriptionApprovedAfter: subscription.subscriptionApprovedAfter ?? 0,
          isOld: subscription.isOld,
        });
      },
      error: err =>
        this.toast.error(
          err?.message ?? this.translate.instant('Failed to load subscription offer'),
        ),
      complete: () => this.loading.set(false),
    });
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const raw = this.form.getRawValue();
    const payload: CustomerSubscriptionUpsertRequest = {
      id: this.subscriptionId() ?? 0,
      nameAr: raw.nameAr.trim(),
      nameEn: raw.nameEn.trim(),
      description: raw.description?.trim() || undefined,
      discount: Number(raw.discount ?? 0),
      isOld: raw.isOld,
      subscriptionApprovedAfter: Number(raw.subscriptionApprovedAfter ?? 0),
      fleetId,
    };

    this.loading.set(true);
    const request$ = this.isEdit()
      ? this.subscriptionService.update(payload)
      : this.subscriptionService.create(payload);

    request$.subscribe({
      next: () => {
        this.toast.success(
          this.translate.instant(this.isEdit() ? 'Subscription offer updated' : 'Subscription offer created'),
        );
        this.router.navigate(['/customer-subscriptions']);
      },
      error: err =>
        this.toast.error(
          err?.message ?? this.translate.instant('Failed to save subscription offer'),
        ),
      complete: () => this.loading.set(false),
    });
  }
}

