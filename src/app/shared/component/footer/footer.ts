import { Component } from '@angular/core';
import { TranslateModule } from '@ngx-translate/core';

import { AppVersionBadgeComponent } from '../../ui/app-version-badge/app-version-badge.component';

@Component({
  selector: 'app-footer',
  templateUrl: './footer.html',
  styleUrls: ['./footer.scss'],
  imports: [TranslateModule, AppVersionBadgeComponent],
})
export class Footer {
  public year = new Date().getFullYear();
}
