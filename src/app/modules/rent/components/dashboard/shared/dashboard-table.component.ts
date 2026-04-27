import { CommonModule, CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

interface DashboardTableColumn {
  key: string;
  label: string;
  format?: 'currency' | 'percent' | 'number' | 'text';
}

@Component({
  selector: 'dashboard-table',
  standalone: true,
  imports: [CommonModule, TranslateModule, CurrencyPipe, PercentPipe, DecimalPipe],
  templateUrl: './dashboard-table.component.html',
  styleUrl: './dashboard-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardTableComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() columns: DashboardTableColumn[] = [];
  @Input() rows: unknown[] = [];
  @Input() loading = false;

  asRecord(value: unknown): Record<string, unknown> {
    return (value ?? {}) as Record<string, unknown>;
  }

  asNumber(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }
}
