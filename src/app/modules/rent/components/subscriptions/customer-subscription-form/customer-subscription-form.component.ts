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
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';
import { coerceFormNumber, requiredNumber } from '../../../../../shared/validators/required-number.validator';
import {
  CustomerSubscription,
  CustomerSubscriptionUpsertRequest,
} from '../../../models/subscriptions/customer-subscription.model';
import { CustomerSubscriptionService } from '../../../services/subscriptions/customer-subscription.service';

@Component({
  selector: 'app-customer-subscription-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, ...SHARED_FORM_FIELD_DIRECTIVES],
  templateUrl: './customer-subscription-form.component.html',
  styleUrl: './customer-subscription-form.component.scss',
})
export class CustomerSubscriptionFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly ARABIC_NAME_REGEX = /^[\u0600-\u06FF\s.'-]{2,255}$/;
  private static readonly ENGLISH_NAME_REGEX = /^[A-Za-z\s.'-]{2,255}$/;

  private static readonly WORKFLOW_SECTION_IDS = [
    'subscription-offer-form-section-identity',
    'subscription-offer-form-section-terms',
    'subscription-offer-form-section-description',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private readonly nullableFb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authState = inject(AuthStateService);
  private subscriptionService = inject(CustomerSubscriptionService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  isEdit = signal(false);
  loading = signal(false);
  subscriptionId = signal<number | null>(null);
  subscriptions = signal<CustomerSubscription[]>([]);
  /** Preserved on edit; not editable in the form UI. */
  private readonly preservedIsOld = signal(false);
  private formProgressTick = signal(0);

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
    discount: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0, max: 100 })]),
    subscriptionApprovedAfter: this.nullableFb.control<number | null>(null, [requiredNumber({ min: 0 })]),
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.nameAr.valid && f.nameEn.valid;
  });

  termsSectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.discount.valid && f.subscriptionApprovedAfter.valid;
  });

  descriptionSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.description.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.termsSectionComplete()) done++;
    if (this.descriptionSectionComplete()) done++;
    return Math.round((done / 3) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.termsSectionComplete()) return 2;
    if (!this.descriptionSectionComplete()) return 3;
    return 4;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    this.loadSubscriptionsRulesContext(fleetId);

    const id = Number(this.route.snapshot.paramMap.get('id') || 0);
    if (!id) {
      return;
    }

    this.isEdit.set(true);
    this.subscriptionId.set(id);
    this.loading.set(true);
    this.subscriptionService.getById(id, fleetId).subscribe({
      next: subscription => {
        this.preservedIsOld.set(!!subscription.isOld);
        this.form.patchValue({
          nameAr: subscription.nameAr,
          nameEn: subscription.nameEn || '',
          description: subscription.description || '',
          discount: subscription.discount ?? 0,
          subscriptionApprovedAfter: subscription.subscriptionApprovedAfter ?? 0,
        });
        this.formProgressTick.update(v => v + 1);
      },
      error: err =>
        this.toast.error(
          err?.message ?? this.translate.instant('Failed to load subscription offer'),
        ),
      complete: () => this.loading.set(false),
    });
  }

  focusWorkflowSection(step: 1 | 2 | 3): void {
    const sectionId = CustomerSubscriptionFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('subscription-offer-form-section--focus');
    window.setTimeout(() => section.classList.remove('subscription-offer-form-section--focus'), 1400);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      this.toast.error(this.translate.instant('FleetId is required'));
      return;
    }

    const raw = this.form.getRawValue();
    const discount = coerceFormNumber(raw.discount);
    const subscriptionApprovedAfter = coerceFormNumber(raw.subscriptionApprovedAfter);
    const businessRuleMessage = this.validateSequenceRules(
      subscriptionApprovedAfter,
      discount,
      this.subscriptionId(),
    );
    if (businessRuleMessage) {
      this.toast.error(this.translate.instant(businessRuleMessage));
      return;
    }

    const payload: CustomerSubscriptionUpsertRequest = {
      id: this.subscriptionId() ?? 0,
      nameAr: raw.nameAr.trim(),
      nameEn: raw.nameEn.trim(),
      description: raw.description?.trim() || undefined,
      discount,
      isOld: this.isEdit() ? this.preservedIsOld() : false,
      subscriptionApprovedAfter,
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

  private loadSubscriptionsRulesContext(fleetId: string): void {
    this.subscriptionService.getList(fleetId).subscribe({
      next: list => this.subscriptions.set(list ?? []),
      error: () => this.subscriptions.set([]),
    });
  }

  private validateSequenceRules(
    approvedAfter: number,
    discount: number,
    currentId: number | null,
  ): string | null {
    const sorted = [...this.subscriptions()].sort(
      (a, b) =>
        (a.subscriptionApprovedAfter ?? 0) - (b.subscriptionApprovedAfter ?? 0) ||
        (a.discount ?? 0) - (b.discount ?? 0) ||
        a.id - b.id,
    );

    if (!sorted.length) {
      return null;
    }

    if (!currentId) {
      const previous = sorted[sorted.length - 1];
      if (
        approvedAfter <= (previous.subscriptionApprovedAfter ?? 0) ||
        discount <= (previous.discount ?? 0)
      ) {
        return 'Subscription order create rule violation';
      }
      return null;
    }

    const currentIndex = sorted.findIndex(item => item.id === currentId);
    if (currentIndex < 0) {
      return null;
    }

    const previous = currentIndex > 0 ? sorted[currentIndex - 1] : null;
    const next = currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : null;

    if (
      previous &&
      (approvedAfter <= (previous.subscriptionApprovedAfter ?? 0) ||
        discount <= (previous.discount ?? 0))
    ) {
      return 'Subscription order previous rule violation';
    }

    if (
      next &&
      (approvedAfter >= (next.subscriptionApprovedAfter ?? 0) ||
        discount >= (next.discount ?? 0))
    ) {
      return 'Subscription order next rule violation';
    }

    return null;
  }

  discountHint(): string {
    const context = this.getSequenceContext();
    if (!this.isEdit()) {
      if (context.last) {
        return this.translate.instant('Must be greater than value', {
          value: context.last.discount ?? 0,
        });
      }
      return this.translate.instant('Any value zero or greater');
    }

    if (context.previous && context.next) {
      return this.translate.instant('Must be between values', {
        min: context.previous.discount ?? 0,
        max: context.next.discount ?? 0,
      });
    }

    if (context.previous) {
      return this.translate.instant('Must be greater than value', {
        value: context.previous.discount ?? 0,
      });
    }

    if (context.next) {
      return this.translate.instant('Must be less than value', {
        value: context.next.discount ?? 0,
      });
    }

    return this.translate.instant('Any value zero or greater');
  }

  subscriptionApprovedAfterHint(): string {
    const context = this.getSequenceContext();
    if (!this.isEdit()) {
      if (context.last) {
        return this.translate.instant('Must be greater than value', {
          value: context.last.subscriptionApprovedAfter ?? 0,
        });
      }
      return this.translate.instant('Any value zero or greater');
    }

    if (context.previous && context.next) {
      return this.translate.instant('Must be between values', {
        min: context.previous.subscriptionApprovedAfter ?? 0,
        max: context.next.subscriptionApprovedAfter ?? 0,
      });
    }

    if (context.previous) {
      return this.translate.instant('Must be greater than value', {
        value: context.previous.subscriptionApprovedAfter ?? 0,
      });
    }

    if (context.next) {
      return this.translate.instant('Must be less than value', {
        value: context.next.subscriptionApprovedAfter ?? 0,
      });
    }

    return this.translate.instant('Any value zero or greater');
  }

  private getSequenceContext(): {
    previous?: CustomerSubscription;
    next?: CustomerSubscription;
    last?: CustomerSubscription;
  } {
    const sorted = [...this.subscriptions()].sort(
      (a, b) =>
        (a.subscriptionApprovedAfter ?? 0) - (b.subscriptionApprovedAfter ?? 0) ||
        (a.discount ?? 0) - (b.discount ?? 0) ||
        a.id - b.id,
    );

    if (!sorted.length) {
      return {};
    }

    const currentId = this.subscriptionId();
    if (!this.isEdit() || !currentId) {
      return { last: sorted[sorted.length - 1] };
    }

    const currentIndex = sorted.findIndex(item => item.id === currentId);
    if (currentIndex < 0) {
      return { last: sorted[sorted.length - 1] };
    }

    return {
      previous: currentIndex > 0 ? sorted[currentIndex - 1] : undefined,
      next: currentIndex < sorted.length - 1 ? sorted[currentIndex + 1] : undefined,
    };
  }
}
