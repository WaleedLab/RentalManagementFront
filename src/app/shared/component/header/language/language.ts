import { Component, HostListener, inject } from '@angular/core';

import { TranslateService } from '@ngx-translate/core';

import { NavMenuService } from '../../../services/layout/nav-menu.service';
import { LayoutService } from '../../../services/layout/layout.service';

interface selectedlanguage {
  language?: string;
  code: string;
  type?: string;
  icon?: string;
}

@Component({
  selector: 'app-language',
  templateUrl: './language.html',
  styleUrls: ['./language.scss'],
  imports: [],
})
export class Language {
  public navServices = inject(NavMenuService);
  private translate = inject(TranslateService);
  private layout = inject(LayoutService);

  public language: boolean = false;

  public languages: selectedlanguage[] = [
    {
      language: 'English',
      code: 'en',
      type: 'US',
      icon: 'us',
    },
    {
      language: 'العربية',
      code: 'ar',
      icon: 'sa',
    },
  ];

  public selectedLanguage: selectedlanguage = {
    language: 'العربية',
    code: 'ar',
    icon: 'sa',
  };

  constructor() {
    const match = this.languages.find(l => l.code === 'ar') ?? this.languages[0];
    this.selectedLanguage = match;
    this.translate.setDefaultLang('ar');
    this.translate.use(match.code);
    this.applyLanguageDirection(match.code);
  }

  toggleLanguageMenu(event: MouseEvent): void {
    event.stopPropagation();
    this.navServices.language = !this.navServices.language;
  }

  changeLanguage(lang: selectedlanguage, event?: MouseEvent) {
    event?.stopPropagation();
    this.translate.use(lang.code);
    this.selectedLanguage = lang;
    this.navServices.language = false;
    this.applyLanguageDirection(lang.code);
  }

  @HostListener('document:click')
  closeLanguageMenu(): void {
    this.navServices.language = false;
  }

  private applyLanguageDirection(languageCode: string): void {
    const normalizedCode = languageCode.toLowerCase();
    const direction = normalizedCode === 'ar' ? 'rtl' : 'ltr';
    this.layout.applyDirection(direction, normalizedCode);
  }
}
