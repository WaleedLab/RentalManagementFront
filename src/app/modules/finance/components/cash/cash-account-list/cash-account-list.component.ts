import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { loginBranchId } from '../../../../../shared/utils/branch-id.util';
import { ToastService } from '../../../../../shared/services/toast.service';
import { CashAccount } from '../../../models/cash/cash-account.model';
import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { CashAccountService } from '../../../services/cash/cash-account.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceDate } from '../../shared/finance-list-formatters';

@Component({
  selector: 'app-cash-account-list',
  standalone: true,
  imports: [FinanceListShellComponent],
  templateUrl: './cash-account-list.component.html',
  styleUrl: './cash-account-list.component.scss',
})
export class CashAccountListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private cashService = inject(CashAccountService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  items = signal<CashAccount[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  private languageTick = signal(0);

  readonly columns: FinanceListColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'description', label: 'Description' },
    { key: 'createdAt', label: 'Date', align: 'end' },
  ];

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    return this.items().map(item => ({
      name: item.name || '-',
      description: item.description || '-',
      createdAt: formatFinanceDate(item.createdAt, this.translate),
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

    this.loading.set(true);
    this.loadError.set(null);

    this.cashService.getList(fleetId, loginBranchId(this.authState.branchId())).subscribe({
      next: items => this.items.set(items),
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

