import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AccountingAlert } from '../../../../models/dashboard/accounting-summary.model';

@Component({
  selector: 'accounting-alerts',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './accounting-alerts.component.html',
  styleUrl: './accounting-alerts.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingAlertsComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() alerts: AccountingAlert[] = [];
  @Input() loading = false;
}
