import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { CreateJournalEntryRequest } from '../../../models/journals/journal-entry.model';
import { JournalEntryService } from '../../../services/journals/journal-entry.service';

@Component({
  selector: 'app-journal-entry-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule, PageHeaderComponent],
  templateUrl: './journal-entry-form.component.html',
})
export class JournalEntryFormComponent implements OnInit {
  private fb = inject(NonNullableFormBuilder);
  private authState = inject(AuthStateService);
  private journalService = inject(JournalEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private router = inject(Router);

  loading = signal(false);

  form = this.fb.group({
    date: ['', [Validators.required]],
    node: ['', [Validators.required, Validators.maxLength(500)]],
    journalType: [true],
    debtir: [0, [Validators.required]],
    credit: [0, [Validators.required]],
    balannce: [0, [Validators.required]],
    operationType: [1, [Validators.required, Validators.min(0)]],
    status: [1, [Validators.required, Validators.min(0)]],
    isSystemOperation: [true],
    idBranch: [Number(this.authState.branchId() ?? 0), [Validators.required, Validators.min(1)]],
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
    const body: CreateJournalEntryRequest = {
      date: new Date(raw.date).toISOString(),
      node: raw.node.trim(),
      journalType: raw.journalType,
      debtir: raw.debtir,
      credit: raw.credit,
      balannce: raw.balannce,
      operationType: raw.operationType,
      status: raw.status,
      isSystemOperation: raw.isSystemOperation,
      idBranch: raw.idBranch,
      fleetId: raw.fleetId.trim(),
    };

    this.loading.set(true);
    this.journalService.create(body).subscribe({
      next: () => {
        this.toast.success(this.translate.instant('Journal entry created successfully'));
        this.router.navigate(['/journals']);
      },
      error: err => {
        this.toast.error(err?.message ?? this.translate.instant('Failed to save journal entry'));
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}
