import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { merge } from 'rxjs';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { loginBranchIdOrNull } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import {
  SmoothSelectComponent,
  SmoothSelectOption,
} from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { isCashCountingCandidate } from '../../../common/finance-accounting-blueprints';
import { CreateCashAccountRequest } from '../../../models/cash/cash-account.model';
import { CountingEntry } from '../../../models/counting/counting-entry.model';
import { CashAccountService } from '../../../services/cash/cash-account.service';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';
import { focusFirstInvalidControl } from '../../../../../shared/utils/focus-first-invalid-control.util';

@Component({
  selector: 'app-cash-account-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, SmoothSelectComponent],
  templateUrl: './cash-account-form.component.html',
  styleUrl: './cash-account-form.component.scss',
})
export class CashAccountFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private static readonly WORKFLOW_SECTION_IDS = [
    'cash-form-section-identity',
    'cash-form-section-accounting',
    'cash-form-section-description',
  ] as const;

  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private cashService = inject(CashAccountService);
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
    description: ['', [Validators.maxLength(500)]],
    fleetId: ['', [Validators.required]],
  });

  identitySectionComplete = computed(() => {
    this.formProgressTick();
    return this.form.controls.name.valid;
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
    const sectionId = CashAccountFormComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('cash-form-section--focus');
    window.setTimeout(() => section.classList.remove('cash-form-section--focus'), 1400);
  }

  hasError(controlName: 'name' | 'countingId'): boolean {
    const control = this.form.controls[controlName];
    return !!control && control.invalid && (control.touched || control.dirty || this.submitAttempted());
  }

  onSubmit(): void {
    this.submitAttempted.set(true);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toast.warning(this.translate.instant('Please complete the required fields'));
      focusFirstInvalidControl(this.hostEl.nativeElement);
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
      countingId: raw.countingId,
      name: raw.name.trim(),
      description: raw.description.trim() || undefined,
      createdBy,
      fleetId: raw.fleetId.trim(),
      idBranch: loginBranchIdOrNull(this.authState.branchId()),
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
      const rand = (Math.random() * 16) | 0;
      const value = char === 'x' ? rand : (rand & 0x3) | 0x8;
      return value.toString(16);
    });
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
      const leftIsCash = isCashCountingCandidate(left);
      const rightIsCash = isCashCountingCandidate(right);
      if (leftIsCash !== rightIsCash) {
        return leftIsCash ? -1 : 1;
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
      if (!sortedEntries.some(isCashCountingCandidate)) {
        this.toast.info(
          this.translate.instant('No dedicated cash account was detected. Showing all available accounts.'),
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
}
