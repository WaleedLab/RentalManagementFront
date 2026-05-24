import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AccountingAlert } from '../../../../models/dashboard/accounting-summary.model';

@Component({
  selector: 'accounting-alert-stack',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './accounting-alert-stack.component.html',
  styleUrl: './accounting-alert-stack.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingAlertStackComponent {
  @Input() alerts: AccountingAlert[] = [];
  @Input() loading = false;
  @Input() error = false;
  @Output() retry = new EventEmitter<void>();
}
