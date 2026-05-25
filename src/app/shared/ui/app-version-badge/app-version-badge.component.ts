import { Component, inject, input } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AppVersionService } from '../../../core/version/app-version.service';

export type AppVersionBadgeVariant = 'default' | 'sidebar' | 'login' | 'splash' | 'footer' | 'settings';

@Component({
  selector: 'app-version-badge',
  standalone: true,
  imports: [TranslateModule],
  templateUrl: './app-version-badge.component.html',
  styleUrl: './app-version-badge.component.scss',
})
export class AppVersionBadgeComponent {
  private readonly appVersion = inject(AppVersionService);

  variant = input<AppVersionBadgeVariant>('default');
  showLabel = input(false);

  readonly displayVersion = this.appVersion.displayVersion;
}
