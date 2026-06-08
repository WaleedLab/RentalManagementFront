import { NgClass } from '@angular/common';
import { ChangeDetectorRef, Component, HostListener, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { Subscription } from 'rxjs';

import { LayoutService } from '../../services/layout/layout.service';
import { NavMenuService } from '../../services/layout/nav-menu.service';
import { Language } from './language/language';
import { Notification } from './notification/notification';
import { Profile } from './profile/profile';
import { Theme } from './theme/theme';

@Component({
  selector: 'app-header',
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
  imports: [
    NgClass,
    Notification,
    Theme,
    Language,
    Profile,
  ],
})
export class Header implements OnInit, OnDestroy {
  public navmenu = inject(NavMenuService);
  private layout = inject(LayoutService);
  private translate = inject(TranslateService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);
  private clockIntervalId: ReturnType<typeof setInterval> | null = null;
  private languageSubscription: Subscription | null = null;

  public gregorianDate = '';
  public hijriDate = '';
  public gregorianNumericDate = '';
  public hijriNumericDate = '';
  public time12 = '';

  public get isArabicLanguage(): boolean {
    return this.getLanguageCode() === 'ar';
  }

  ngOnInit(): void {
    this.layout.scheduleCompactHeaderOffsetSync();
    this.refreshDateTime();
    this.clockIntervalId = setInterval(() => {
      this.zone.run(() => {
        this.refreshDateTime();
        this.cdr.detectChanges();
      });
    }, 1000);
    this.languageSubscription = this.translate.onLangChange.subscribe(() => {
      this.refreshDateTime();
      this.layout.scheduleCompactHeaderOffsetSync();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    if (this.clockIntervalId) {
      clearInterval(this.clockIntervalId);
      this.clockIntervalId = null;
    }

    this.languageSubscription?.unsubscribe();
    this.languageSubscription = null;
  }

  openMenu() {
    this.navmenu.isDisplay = !this.navmenu.isDisplay;
  }

  @HostListener('window:resize')
  onResize() {
    this.navmenu.isDisplay = window.innerWidth < 992;
    this.layout.scheduleCompactHeaderOffsetSync();
  }

  private refreshDateTime(): void {
    const now = new Date();
    const isArabic = this.getLanguageCode() === 'ar';
    const baseLocale = isArabic ? 'ar-SA' : 'en-US';
    const hijriLocale = isArabic ? 'ar-SA-u-ca-islamic-umalqura' : 'en-US-u-ca-islamic-umalqura';

    this.gregorianDate = new Intl.DateTimeFormat(baseLocale, {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      weekday: isArabic ? 'long' : 'short',
      calendar: 'gregory',
    }).format(now);

    this.hijriDate = new Intl.DateTimeFormat(hijriLocale, {
      year: 'numeric',
      month: 'long',
      day: '2-digit',
      weekday: isArabic ? 'long' : 'short',
      era: 'short',
    }).format(now);

    this.gregorianNumericDate = new Intl.DateTimeFormat(baseLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      calendar: 'gregory',
    }).format(now);

    this.hijriNumericDate = new Intl.DateTimeFormat(hijriLocale, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      era: 'short',
    }).format(now);

    this.time12 = new Intl.DateTimeFormat(baseLocale, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }).format(now);

  }

  private getLanguageCode(): 'ar' | 'en' {
    const language =
      this.translate.currentLang?.toLowerCase() ||
      this.translate.defaultLang?.toLowerCase() ||
      'en';

    return language.startsWith('ar') ? 'ar' : 'en';
  }
}
