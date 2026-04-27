import { CommonModule, CurrencyPipe, DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DashboardStatusTone } from '../../../models/dashboard/dashboard-summary.model';

@Component({
  selector: 'dashboard-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, CurrencyPipe, PercentPipe, DecimalPipe],
  templateUrl: './dashboard-card.component.html',
  styleUrl: './dashboard-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardCardComponent {
  @Input() label = '';
  @Input() value = 0;
  @Input() format: 'currency' | 'percent' | 'number' = 'number';
  @Input() tone: DashboardStatusTone = 'good';
  @Input() loading = false;
}
