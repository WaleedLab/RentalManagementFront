import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { Bank } from '../../../models/banks/bank.model';
import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { BankService } from '../../../services/banks/bank.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceDate } from '../../shared/finance-list-formatters';

@Component({
  selector: 'app-bank-list',
  standalone: true,
  imports: [FinanceListShellComponent],
  templateUrl: './bank-list.component.html',
  styleUrl: './bank-list.component.scss',
})
export class BankListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private bankService = inject(BankService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  banks = signal<Bank[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  private languageTick = signal(0);

  readonly columns: FinanceListColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'code', label: 'Code' },
    { key: 'description', label: 'Description' },
    { key: 'createdAt', label: 'Date', align: 'end' },
  ];

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    return this.banks().map(bank => ({
      name: bank.name || '-',
      code: bank.code || '-',
      description: bank.description || '-',
      createdAt: formatFinanceDate(bank.createdAt, this.translate),
    }));
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(value => value + 1);
    });
    this.load();
  }

  private load(): void {
    const fleetId = this.authState.fleetId();
    if (!fleetId) {
      const message = this.translate.instant('FleetId is required');
      this.loadError.set(message);
      this.toast.error(message);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);

    this.bankService.getList(fleetId).subscribe({
      next: items => this.banks.set(items),
      error: err => {
        const message = err?.message ?? this.translate.instant('No records found');
        this.loadError.set(message);
        this.toast.error(message);
        this.loading.set(false);
      },
      complete: () => this.loading.set(false),
    });
  }
}

