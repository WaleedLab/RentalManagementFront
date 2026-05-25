import { Injectable } from '@angular/core';

import { APP_VERSION, formatAppVersionLabel } from './app-version';

@Injectable({ providedIn: 'root' })
export class AppVersionService {
  readonly version = APP_VERSION;
  readonly displayVersion = formatAppVersionLabel(APP_VERSION);
}
