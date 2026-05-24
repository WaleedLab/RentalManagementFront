import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { FinancialFeedItem } from '../../../../models/dashboard/accounting-intelligence.model';

@Component({
  selector: 'accounting-activity-feed',
  standalone: true,
  imports: [CommonModule, TranslateModule, CurrencyPipe, DatePipe],
  templateUrl: './accounting-activity-feed.component.html',
  styleUrl: './accounting-activity-feed.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingActivityFeedComponent {
  @Input() items: FinancialFeedItem[] = [];
  @Input() loading = false;
  @Input() postedCount = 0;
  @Input() pendingCount = 0;
}
