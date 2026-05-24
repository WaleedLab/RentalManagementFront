import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AccountingInsight } from '../../../../models/dashboard/accounting-intelligence.model';

@Component({
  selector: 'accounting-insight-strip',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './accounting-insight-strip.component.html',
  styleUrl: './accounting-insight-strip.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingInsightStripComponent {
  @Input() insights: AccountingInsight[] = [];
  @Input() loading = false;
}
