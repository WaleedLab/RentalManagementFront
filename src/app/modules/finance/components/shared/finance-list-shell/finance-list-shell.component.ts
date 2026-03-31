import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';
import { RouterLink } from '@angular/router';

import { FinanceListColumn, FinanceListRow } from '../../../models/shared/finance-list.model';
import { EmptyStateComponent } from '../../../../../shared/ui/empty-state/empty-state.component';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';

@Component({
  selector: 'app-finance-list-shell',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, PageHeaderComponent, EmptyStateComponent],
  templateUrl: './finance-list-shell.component.html',
  styleUrl: './finance-list-shell.component.scss',
})
export class FinanceListShellComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() emptyTitle = 'No records found';
  @Input() emptyDescription = 'No records were returned for the current fleet context.';
  @Input() error: string | null = null;
  @Input() loading = false;
  @Input() count = 0;
  @Input() columns: FinanceListColumn[] = [];
  @Input() rows: FinanceListRow[] = [];
  @Input() createLink: string | null = null;
  @Input() createLabel = 'Create';

  trackByIndex(index: number): number {
    return index;
  }
}

