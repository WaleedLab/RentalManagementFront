import { CommonModule } from '@angular/common';
import { Component, DestroyRef, EventEmitter, Input, OnInit, Output, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

import {
  FinanceListAction,
  FinanceListColumn,
  FinanceListRow,
} from '../../../models/shared/finance-list.model';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { PaginationBarComponent } from '../../../../../shared/ui/pagination-bar/pagination-bar.component';
import { SmoothSelectComponent, SmoothSelectOption } from '../../../../../shared/ui/smooth-select/smooth-select.component';
import { DateRangeFilterComponent, DateRangeValue } from '../../../../../shared/ui/date-range-filter/date-range-filter.component';

@Component({
  selector: 'app-finance-list-shell',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    RouterLink,
    PageHeaderComponent,
    EmptyStateComponent,
    PaginationBarComponent,
    SmoothSelectComponent,
    DateRangeFilterComponent,
  ],
  templateUrl: './finance-list-shell.component.html',
  styleUrl: './finance-list-shell.component.scss',
})
export class FinanceListShellComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly languageTick = signal(0);

  @Input() title = '';
  @Input() subtitle = '';
  @Input() emptyTitle = 'Table empty hint';
  @Input() emptyDescription = '';
  @Input() error: string | null = null;
  @Input() loading = false;
  @Input() count = 0;
  @Input() columns: FinanceListColumn[] = [];
  @Input() rows: FinanceListRow[] = [];
  @Input() createLink: string | null = null;
  @Input() createLabel = 'Create';
  @Input() searchPlaceholder = 'Search';
  @Input() searchValue = '';
  @Input() enableSearch = false;
  @Input() orderByValue = '';
  @Input() orderByDirectionValue: 'ASC' | 'DESC' = 'DESC';
  @Input() orderByOptions: SmoothSelectOption[] = [];
  @Input() enableSorting = false;
  @Input() enableDateRangeFilter = false;
  @Input() dateFrom = '';
  @Input() dateTo = '';
  @Input() pageNumber = 1;
  @Input() totalPages = 1;
  @Input() pageSize = 10;
  @Input() showPageSize = true;
  @Input() pageSizeOptions: number[] = [10, 20, 50, 100];
  @Input() rowActions: FinanceListAction[] = [];

  @Output() searchChange = new EventEmitter<string>();
  @Output() orderByChange = new EventEmitter<string>();
  @Output() orderByDirectionChange = new EventEmitter<'ASC' | 'DESC'>();
  @Output() dateRangeChange = new EventEmitter<DateRangeValue>();
  @Output() pageChange = new EventEmitter<number>();
  @Output() pageSizeChange = new EventEmitter<number>();
  @Output() rowAction = new EventEmitter<{ actionKey: string; rowIndex: number }>();

  readonly orderByDirectionOptions = computed<SmoothSelectOption[]>(() => {
    this.languageTick();
    const t = (key: string) => this.translate.instant(key);
    return [
      { label: t('Newest'), value: 'DESC' },
      { label: t('Oldest'), value: 'ASC' },
    ];
  });

  ngOnInit(): void {
    this.translate.onLangChange.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.languageTick.update(v => v + 1);
    });
  }

  onSearchChange(value: string): void {
    this.searchChange.emit(value ?? '');
  }

  onOrderByChange(value: string | number | null): void {
    this.orderByChange.emit(String(value ?? '').trim());
  }

  onOrderByDirectionChange(value: string | number | null): void {
    const normalized = String(value ?? '').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    this.orderByDirectionChange.emit(normalized);
  }

  onDateRangeChange(value: DateRangeValue): void {
    this.dateRangeChange.emit(value);
  }

  trackByIndex(index: number): number {
    return index;
  }

  emitRowAction(actionKey: string, rowIndex: number): void {
    this.rowAction.emit({ actionKey, rowIndex });
  }

  getActionRouterLink(action: FinanceListAction, row: FinanceListRow): string[] | null {
    return action.route?.(row) ?? null;
  }

  /** Treat non-empty `error` as a failed load: show loading state in the table area. */
  hasBlockingError(): boolean {
    return typeof this.error === 'string' && this.error.trim().length > 0;
  }
}

