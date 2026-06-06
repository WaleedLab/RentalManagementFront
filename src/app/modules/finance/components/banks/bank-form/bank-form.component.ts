import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { loginBranchId } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { isBankCountingCandidate } from '../../../common/finance-accounting-blueprints';
import { CreateBankRequest } from '../../../models/banks/bank.model';
import { CountingEntry } from '../../../models/counting/counting-entry.model';
import { BankService } from '../../../services/banks/bank.service';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-bank-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, SmoothSelectComponent],
  templateUrl: './bank-form.component.html',
  styleUrl: './bank-form.component.scss',
})
export class BankFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'bank-form-section-identity',
    'bank-form-section-accounting',
    'bank-form-section-description',
  ] as const;
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private bankService = inject(BankService);
  private countingService = inject(CountingEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  loading = signal(false);
  private readonly i18nTick = signal(0);
  private formProgressTick = signal(0);
  loadingAccounts = signal(false);
  submitAttempted = signal(false);
  countingEntries = signal<CountingEntry[]>([]);

  readonly countingOptions = computed<SmoothSelectOption[]>(() => {
    this.i18nTick();
    return [
      { label: this.translate.instant('Select account from chart'), value: '' },
      ...this.countingEntries().map(entry => ({
        label: this.formatAccountLabel(entry),
        value: entry.id,
      })),
    ];
  });

  form = this.fb.group({
    countingId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.required, Validators.maxLength(500)]],
    code: ['', [Validators.required, Validators.maxLength(100)]],
    fleetId: ['', [Validators.required]],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    const f = this.form.controls;
    return f.name.valid && f.code.valid;
  });

  accountingSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.countingId.valid;
  });

  descriptionSectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.description.valid;
  });

  profileCompletionPercent = computed(() => {
    this.formProgressTick();
    let done = 0;
    if (this.identitySectionComplete()) done++;
    if (this.accountingSectionComplete()) done++;
    if (this.descriptionSectionComplete()) done++;
    return Math.round((done / 3) * 100);
  });

  currentWorkflowStep = computed(() => {
    this.formProgressTick();
    if (!this.identitySectionComplete()) return 1;
    if (!this.accountingSectionComplete()) return 2;
    if (!this.descriptionSectionComplete()) return 3;
    return 4;
  });

  ngOnInit(): void {
    merge(this.form.valueChanges, this.form.statusChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formProgressTick.update(v => v + 1));

    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.i18nTick.update(value => value + 1);
    });
    this.form.controls.fleetId.setValue(this.authState.fleetId() ?? '');
    this.loadCountingEntries();
  }

  focusWorkflowSection(step: 1 | 2 | 3): void {
    const sectionId = BankFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('bank-form-section--focus');
    window.setTimeout(() => section.classList.remove('bank-form-section--focus'), 1400);
  }

  onSubmit(): void {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning(this.translate.instant('Please complete the required fields'));
      focusFirstInvalidControl(this.hostEl.nativeElement);
      return;
    }

    const raw = this.form.getRawValue();
    const body: CreateBankRequest = {
      countingId: raw.countingId,
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      code: raw.code.trim() || undefined,
      fleetId: raw.fleetId.trim(),
      idBranch: loginBranchId(this.authState.branchId()),
    };

    this.loading.set(true);
    this.bankService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Bank created successfully'));
        this.router.navigate(['/banks']);
      },
      error: err => {
        this.applyServerValidationErrors(err);
        this.toast.error(this.resolveCreateBankErrorMessage(err));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }

  hasError(controlName: keyof typeof this.form.controls): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  getErrorMessage(controlName: keyof typeof this.form.controls): string {
    const control = this.form.controls[controlName];
    if (!control?.errors) {
      return '';
    }

    if (control.errors['server']) {
      return String(control.errors['server']);
    }

    if (control.errors['required']) {
      return this.translate.instant('This field is required');
    }

    if (control.errors['maxlength']) {
      const requiredLength = control.errors['maxlength']?.requiredLength;
      return this.translate.instant('Maximum length is {{max}} characters', { max: requiredLength });
    }

    return this.translate.instant('Please check this field');
  }

  private loadCountingEntries(): void {
    const fleetId = this.authState.fleetId() ?? this.form.controls.fleetId.value;
    this.loadingAccounts.set(true);
    this.countingService.getList(fleetId).subscribe({
      next: entries => this.applyCountingEntries(entries, fleetId),
      error: err => {
        if (fleetId) {
          this.countingService.getList(null).subscribe({
            next: fallbackEntries => this.applyCountingEntries(fallbackEntries, null),
            error: fallbackErr => {
              this.toast.error(
                fallbackErr?.message ?? err?.message ?? this.translate.instant('Failed to load accounts'),
              );
              this.loadingAccounts.set(false);
            },
            complete: () => this.loadingAccounts.set(false),
          });
          return;
        }

        this.toast.error(err?.message ?? this.translate.instant('Failed to load accounts'));
        this.loadingAccounts.set(false);
      },
      complete: () => this.loadingAccounts.set(false),
    });
  }

  private applyCountingEntries(entries: CountingEntry[], fleetId?: string | null): void {
    const activeEntries = entries.filter(entry => !entry.isDeleted);
    const sourceEntries = activeEntries.length > 0 ? activeEntries : entries;
    const sortedEntries = [...sourceEntries].sort((left, right) => {
      const leftIsBank = isBankCountingCandidate(left);
      const rightIsBank = isBankCountingCandidate(right);
      if (leftIsBank !== rightIsBank) {
        return leftIsBank ? -1 : 1;
      }

      const leftNumber = Number(left.countingNumber ?? Number.MAX_SAFE_INTEGER);
      const rightNumber = Number(right.countingNumber ?? Number.MAX_SAFE_INTEGER);
      if (leftNumber !== rightNumber) {
        return leftNumber - rightNumber;
      }

      return this.formatAccountLabel(left).localeCompare(this.formatAccountLabel(right), 'ar', {
        sensitivity: 'base',
      });
    });

    if (sortedEntries.length > 0) {
      this.countingEntries.set(sortedEntries);
      if (!sortedEntries.some(isBankCountingCandidate)) {
        this.toast.info(
          this.translate.instant('No dedicated bank account was detected. Showing all available accounts.'),
        );
      }
      this.loadingAccounts.set(false);
      return;
    }

    if (fleetId) {
      this.countingService.getList(null).subscribe({
        next: fallbackEntries => {
          const fallbackActiveEntries = fallbackEntries.filter(entry => !entry.isDeleted);
          const fallbackSource = fallbackActiveEntries.length > 0 ? fallbackActiveEntries : fallbackEntries;
          this.countingEntries.set(
            [...fallbackSource].sort(
              (left, right) =>
                Number(left.countingNumber ?? Number.MAX_SAFE_INTEGER) -
                Number(right.countingNumber ?? Number.MAX_SAFE_INTEGER),
            ),
          );

          if (this.countingEntries().length === 0) {
            this.toast.warning(this.translate.instant('No accounts found in chart of accounts'));
          }
          this.loadingAccounts.set(false);
        },
        error: () => {
          this.toast.warning(this.translate.instant('No accounts found in chart of accounts'));
          this.loadingAccounts.set(false);
        },
      });
      return;
    }

    this.toast.warning(this.translate.instant('No accounts found in chart of accounts'));
    this.loadingAccounts.set(false);
  }

  private formatAccountLabel(entry: CountingEntry): string {
    const isArabic = this.translate.currentLang?.startsWith('ar');
    const name = (isArabic ? entry.nameAr : entry.nameEn) || entry.nameAr || entry.nameEn || '-';
    const number = entry.countingNumber ?? '-';
    return `${number} - ${name}`;
  }

  private resolveCreateBankErrorMessage(err: unknown): string {
    if (!(err instanceof HttpErrorResponse)) {
      return this.translate.instant('Failed to save bank');
    }

    const body = err.error as unknown;
    const backendMessage = this.extractBackendMessage(body);
    if (backendMessage) {
      return backendMessage;
    }

    if (err.status === 400 && this.form.invalid) {
      return this.translate.instant('Please complete the required fields');
    }

    return this.translate.instant('Failed to save bank');
  }

  private applyServerValidationErrors(err: unknown): void {
    if (!(err instanceof HttpErrorResponse) || !err.error || typeof err.error !== 'object') {
      return;
    }

    const payload = err.error as Record<string, unknown>;
    const errorsNode =
      (payload['errors'] as Record<string, unknown> | undefined) ??
      ((payload['error'] as Record<string, unknown> | undefined)?.['propertyErrors'] as
        | Record<string, unknown>
        | undefined);

    if (!errorsNode || typeof errorsNode !== 'object') {
      return;
    }

    let foundAny = false;
    Object.entries(errorsNode).forEach(([rawKey, rawValue]) => {
      const control = this.matchControlByServerKey(rawKey);
      if (!control) {
        return;
      }

      const message = Array.isArray(rawValue)
        ? rawValue.map(x => String(x)).find(Boolean)
        : typeof rawValue === 'string'
          ? rawValue
          : '';

      const currentErrors = control.errors ?? {};
      control.setErrors({
        ...currentErrors,
        server: message || this.translate.instant('Please check this field'),
      });
      control.markAsTouched();
      foundAny = true;
    });

    if (foundAny) {
      this.form.markAllAsTouched();
      focusFirstInvalidControl(this.hostEl.nativeElement);
    }
  }

  private matchControlByServerKey(rawKey: string) {
    const normalized = rawKey.replace(/[^a-zA-Z]/g, '').toLowerCase();
    const candidates: Record<string, keyof typeof this.form.controls> = {
      countingid: 'countingId',
      idcounting: 'countingId',
      name: 'name',
      code: 'code',
      description: 'description',
      fleetid: 'fleetId',
    };
    const mapped = candidates[normalized];
    return mapped ? this.form.controls[mapped] : null;
  }

  private extractBackendMessage(errorBody: unknown): string | null {
    if (typeof errorBody === 'string') {
      const trimmed = errorBody.trim();
      return trimmed ? trimmed : null;
    }
    if (!errorBody || typeof errorBody !== 'object') {
      return null;
    }

    const e = errorBody as Record<string, unknown>;
    const message = e['message'];
    if (typeof message === 'string' && message.trim()) {
      return message.trim();
    }

    const title = e['title'];
    const detail = e['detail'];
    if (typeof title === 'string' && typeof detail === 'string' && detail.trim()) {
      return `${title}: ${detail}`;
    }
    if (typeof detail === 'string' && detail.trim()) {
      return detail.trim();
    }

    const errors = e['errors'];
    if (errors && typeof errors === 'object') {
      const first = Object.values(errors as Record<string, unknown>)
        .flatMap(value => (Array.isArray(value) ? value : [value]))
        .map(x => String(x))
        .find(Boolean);
      if (first) {
        return first;
      }
    }

    return null;
  }
}
