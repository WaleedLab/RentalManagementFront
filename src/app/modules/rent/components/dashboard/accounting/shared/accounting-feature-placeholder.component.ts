import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'accounting-feature-placeholder',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './accounting-feature-placeholder.component.html',
  styleUrl: './accounting-feature-placeholder.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountingFeaturePlaceholderComponent {
  @Input() titleKey = '';
  @Input() bodyKey = '';
  @Input() icon = '◌';
}
