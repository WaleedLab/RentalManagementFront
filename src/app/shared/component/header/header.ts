import { NgClass } from '@angular/common';
import { Component, HostListener, inject } from '@angular/core';

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
export class Header {
  public navmenu = inject(NavMenuService);

  openMenu() {
    this.navmenu.isDisplay = !this.navmenu.isDisplay;
  }

  @HostListener('window:resize')
  onResize() {
    this.navmenu.isDisplay = window.innerWidth < 992;
  }
}
