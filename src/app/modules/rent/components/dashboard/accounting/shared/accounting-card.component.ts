import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AccountingAlertTone } from '../../../../models/dashboard/accounting-summary.model';

@Component({
  selector: 'accounting-card',
  standalone: true,
  imports: [CommonModule, TranslateModule, CurrencyPipe, DecimalPipe],
  templateUrl: './accounting-card.component.html',
  styleUrl: './accounting-card.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingCardComponent {
  @Input() label = '';
  @Input() value = 0;
  @Input() format: 'currency' | 'number' = 'currency';
  @Input() tone: AccountingAlertTone = 'good';
  @Input() loading = false;
  @Input() unavailable = false;
  @Input() unavailableHint = 'Balance requires aggregation API';
}
