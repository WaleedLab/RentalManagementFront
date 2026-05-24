import { CommonModule, CurrencyPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { FinancialHeroStatus } from '../../../../models/dashboard/accounting-intelligence.model';
import { AccountingChartComponent } from './accounting-chart.component';

@Component({
  selector: 'accounting-hero-status',
  standalone: true,
  imports: [CommonModule, TranslateModule, CurrencyPipe, AccountingChartComponent],
  templateUrl: './accounting-hero-status.component.html',
  styleUrl: './accounting-hero-status.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingHeroStatusComponent {
  @Input() hero: FinancialHeroStatus | null = null;
  @Input() loading = false;
  @Input() error = false;

  growthArrow(): string {
    const g = this.hero?.growthPercent;
    if (g == null || !Number.isFinite(g)) {
      return '→';
    }
    return g > 0 ? '↑' : g < 0 ? '↓' : '→';
  }
}
