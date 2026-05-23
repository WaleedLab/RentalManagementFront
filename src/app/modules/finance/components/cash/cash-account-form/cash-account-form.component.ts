import { CommonModule } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { loginBranchId } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    PageHeaderComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './cash-account-form.component.html',
})
export class CashAccountFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
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
  loadingAccounts = signal(false);
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

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.i18nTick.update(value => value + 1);
    });
    this.form.controls.fleetId.setValue(this.authState.fleetId() ?? '');
    this.loadCountingEntries();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
      idBranch: loginBranchId(this.authState.branchId()),
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
            complete: () => {},
          });
          return;
        }

        this.toast.error(err?.message ?? this.translate.instant('Failed to load accounts'));
        this.loadingAccounts.set(false);
      },
      complete: () => {},
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
        },
        error: () => {
          this.toast.warning(this.translate.instant('No accounts found in chart of accounts'));
        },
        complete: () => this.loadingAccounts.set(false),
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
