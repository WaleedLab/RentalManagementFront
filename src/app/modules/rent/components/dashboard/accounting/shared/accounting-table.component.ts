import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

interface AccountingTableColumn {
  key: string;
  label: string;
  format?: 'currency' | 'number' | 'date' | 'text' | 'balance';
}

@Component({
  selector: 'accounting-table',
  standalone: true,
  imports: [CommonModule, TranslateModule, CurrencyPipe, DecimalPipe, DatePipe],
  templateUrl: './accounting-table.component.html',
  styleUrl: './accounting-table.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingTableComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() columns: AccountingTableColumn[] = [];
  @Input() rows: unknown[] = [];
  @Input() loading = false;

  asRecord(value: unknown): Record<string, unknown> {
    return (value ?? {}) as Record<string, unknown>;
  }

  asNumber(value: unknown): number {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  asDate(value: unknown): string | number | Date | null {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === 'string' || typeof value === 'number') {
      return value;
    }
    return null;
  }
}
