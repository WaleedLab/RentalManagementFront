import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { FinancialYear } from '../../../models/financial-years/financial-year.model';
import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { FinancialYearService } from '../../../services/financial-years/financial-year.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceDate, formatFinanceNumber } from '../../shared/finance-list-formatters';

@Component({
  selector: 'app-financial-year-list',
  standalone: true,
  imports: [FinanceListShellComponent],
  templateUrl: './financial-year-list.component.html',
  styleUrl: './financial-year-list.component.scss',
})
export class FinancialYearListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private financialYearService = inject(FinancialYearService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  items = signal<FinancialYear[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  private languageTick = signal(0);

  readonly columns: FinanceListColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'yearNumber', label: 'Year Number', align: 'end' },
    { key: 'dateRange', label: 'Hierarchy' },
    { key: 'current', label: 'Current Year', align: 'end' },
  ];

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    return this.items().map(item => ({
      name: item.name || '-',
      yearNumber: formatFinanceNumber(item.financialYearNumber, this.translate),
      dateRange: `${formatFinanceDate(item.startDate, this.translate)} - ${formatFinanceDate(item.endDate, this.translate)}`,
      current: item.isCurrentYear ? this.translate.instant('Yes') : this.translate.instant('No'),
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

    this.financialYearService.getList(fleetId).subscribe({
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

