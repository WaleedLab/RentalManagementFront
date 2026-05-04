import { inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { LayoutService } from '../services/layout/layout.service';

/**
 * Loads ngx-translate bundles and sets **Arabic (RTL)** as the active language before any route
 * (including login). Optional in-session switch to English remains available from the header.
 */
export function bootstrapI18nFromStorage(): Promise<void> {
  const translate = inject(TranslateService);
  const layout = inject(LayoutService);

  translate.setDefaultLang('ar');
  const lang = 'ar';
  const direction = 'rtl';

  return firstValueFrom(translate.use(lang)).then(() => {
    layout.applyDirection(direction, lang);
  });
}
