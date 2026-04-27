import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { DashboardAlert } from '../../../models/dashboard/dashboard-summary.model';

@Component({
  selector: 'alerts-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './alerts-panel.component.html',
  styleUrl: './alerts-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AlertsPanelComponent {
  @Input() title = '';
  @Input() subtitle = '';
  @Input() alerts: DashboardAlert[] = [];
  @Input() loading = false;
}
