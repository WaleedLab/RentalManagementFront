import { Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';

import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { ToastService } from '../../../../../shared/services/toast.service';
import { JournalEntry } from '../../../models/journals/journal-entry.model';
import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { JournalEntryService } from '../../../services/journals/journal-entry.service';
import { FinanceListShellComponent } from '../../shared/finance-list-shell/finance-list-shell.component';
import { formatFinanceDate, formatFinanceNumber } from '../../shared/finance-list-formatters';

@Component({
  selector: 'app-journal-entry-list',
  standalone: true,
  imports: [FinanceListShellComponent],
  templateUrl: './journal-entry-list.component.html',
  styleUrl: './journal-entry-list.component.scss',
})
export class JournalEntryListComponent implements OnInit {
  private authState = inject(AuthStateService);
  private journalService = inject(JournalEntryService);
  private toast = inject(ToastService);
  private translate = inject(TranslateService);
  private destroyRef = inject(DestroyRef);

  items = signal<JournalEntry[]>([]);
  loading = signal(false);
  loadError = signal<string | null>(null);
  private languageTick = signal(0);

  readonly columns: FinanceListColumn[] = [
    { key: 'number', label: 'Entry Number', align: 'end' },
    { key: 'date', label: 'Date' },
    { key: 'note', label: 'Note' },
    { key: 'amount', label: 'Balance', align: 'end' },
    { key: 'entryType', label: 'Payment Type', align: 'end' },
  ];

  readonly rows = computed<FinanceListRow[]>(() => {
    this.languageTick();
    return this.items().map(item => ({
      number: formatFinanceNumber(item.journalNumper, this.translate),
      date: formatFinanceDate(item.date, this.translate),
      note: item.node || '-',
      amount: formatFinanceNumber(item.balannce, this.translate),
      entryType: item.isManual ? this.translate.instant('Manual') : this.translate.instant('Automatic'),
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

    this.journalService.getList(fleetId).subscribe({
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

