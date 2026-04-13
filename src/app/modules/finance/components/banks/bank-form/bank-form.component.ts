import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
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
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    TranslateModule,
    PageHeaderComponent,
    SmoothSelectComponent,
  ],
  templateUrl: './bank-form.component.html',
})
export class BankFormComponent implements OnInit {
  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private bankService = inject(BankService);
  private countingService = inject(CountingEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);
  loadingAccounts = signal(false);
  countingEntries = signal<CountingEntry[]>([]);

  readonly countingOptions = computed<SmoothSelectOption[]>(() => [
    { label: 'Select account from chart', value: '' },
    ...this.countingEntries().map(entry => ({
      label: this.formatAccountLabel(entry),
      value: entry.id,
    })),
  ]);

  form = this.fb.group({
    countingId: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(255)]],
    description: ['', [Validators.maxLength(500)]],
    code: ['', [Validators.maxLength(100)]],
    fleetId: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.form.controls.fleetId.setValue(this.authState.fleetId() ?? '');
    this.loadCountingEntries();
  }

  onSubmit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
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
