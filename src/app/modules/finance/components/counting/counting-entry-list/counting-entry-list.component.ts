import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { CountingEntry } from '../../../models/counting/counting-entry.model';
import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { CountingEntryService } from '../../../services/counting/counting-entry.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceNumber } from '../../shared/finance-list-formatters';

@Component({
  selector: 'app-counting-entry-list',
  standalone: true,
  imports: [FinanceListShellComponent],
  templateUrl: './counting-entry-list.component.html',
  styleUrl: './counting-entry-list.component.scss',
})
export class CountingEntryListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private countingService = inject(CountingEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  items = signal<CountingEntry[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  private languageTick = signal(0);

  readonly columns: FinanceListColumn[] = [
    { key: 'number', label: 'Count Number' },
    { key: 'name', label: 'Name' },
    { key: 'level', label: 'Account Level', align: 'end' },
    { key: 'balance', label: 'Balance', align: 'end' },
  ];

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    const isArabic = this.translate.currentLang?.startsWith('ar');
    return this.items().map(item => ({
      number: formatFinanceNumber(item.countingNumber, this.translate),
      name: (isArabic ? item.nameAr : item.nameEn) || item.nameAr || item.nameEn || '-',
      level: formatFinanceNumber(item.countingLevel, this.translate),
      balance: formatFinanceNumber(item.balannce, this.translate),
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

    this.countingService.getList(fleetId).subscribe({
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

