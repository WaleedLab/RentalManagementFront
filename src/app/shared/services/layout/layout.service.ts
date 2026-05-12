import { Injectable } from '@angular/core';

export type AppThemeId = 'dark-only' | 'light-only';

@Injectable({
  providedIn: 'root',
})
export class LayoutService {
  private static readonly THEME_STORAGE_KEY = 'rental-app.layout-theme';

  public customizer: string = '';

  public config = {
    settings: {
      layout: '',
      layout_type: 'rtl' as 'ltr' | 'rtl',
      layout_version: 'dark-only',
      sidebar_type: 'compact-wrapper',
      icon: 'fill-svg',
    },
    color: {
      primary_color: '#307EF3',
      secondary_color: '#EBA31D',
    },
  };

  constructor() {
    this.applyDirection(this.config.settings.layout_type);
    this.applyTheme(this.getInitialTheme());

    document.documentElement.style.setProperty('--theme-default', this.config.color.primary_color);
    document.documentElement.style.setProperty(
      '--theme-secondary',
      this.config.color.secondary_color,
    );
  }

  applyDirection(direction: 'ltr' | 'rtl', language?: string): void {
    this.config.settings.layout_type = direction;

    const html = document.documentElement;
    html.setAttribute('dir', direction);

    if (language) {
      html.setAttribute('lang', language);
    }

    document.body.classList.toggle('rtl', direction === 'rtl');
    document.body.classList.toggle('ltr', direction === 'ltr');
  }

  applyTheme(theme: AppThemeId): void {
    this.config.settings.layout_version = theme;
    document.body.classList.toggle('dark-only', theme === 'dark-only');
    document.body.classList.toggle('light-only', theme === 'light-only');
    this.persistTheme(theme);
  }

  toggleTheme(): AppThemeId {
    const nextTheme = this.config.settings.layout_version === 'dark-only' ? 'light-only' : 'dark-only';
    this.applyTheme(nextTheme);
    return nextTheme;
  }

  private getInitialTheme(): AppThemeId {
    try {
      const raw = String(localStorage.getItem(LayoutService.THEME_STORAGE_KEY) ?? '').trim();
      if (raw === 'light-only' || raw === 'dark-only') {
        return raw;
      }
    } catch {
      /* private mode / blocked storage */
    }
    return 'dark-only';
  }

  private persistTheme(theme: AppThemeId): void {
    try {
      localStorage.setItem(LayoutService.THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }
}
