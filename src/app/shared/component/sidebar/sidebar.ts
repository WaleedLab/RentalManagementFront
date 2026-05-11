import { NgClass, NgTemplateOutlet } from '@angular/common';
import { Component, HostBinding, HostListener, effect, inject, OnInit } from '@angular/core';
import { NavigationEnd, Router, RouterLink } from '@angular/router';

import { TranslateModule } from '@ngx-translate/core';

import { AuthStateService } from '../../../core/auth/auth-state.service';
import { AuthService } from '../../services/auth/auth.service';
import { SidebarService } from '../../services/layout/sidebar.service';
import { LayoutService } from '../../services/layout/layout.service';
import { Menu, NavMenuService } from '../../services/layout/nav-menu.service';
import { Feathericon } from '../feathericon/feathericon';
import { SvgIcon } from '../svg-icon/svg-icon';

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrls: ['./sidebar.scss'],
  imports: [
    RouterLink,
    Feathericon,
    NgTemplateOutlet,
    SvgIcon,
    TranslateModule,
    NgClass,
  ],
})
export class Sidebar implements OnInit {
  public navServices = inject(NavMenuService);

  /** Mirrors `NavMenuService.isDisplay` / `.sidebar-wrapper.close_icon` — scoped rail styles live in `sidebar.scss`. */
  @HostBinding('class.sidebar-rail')
  protected get sidebarRailMode(): boolean {
    return this.navServices.isDisplay;
  }
  public layout = inject(LayoutService);
  private router = inject(Router);
  private sidebarService = inject(SidebarService);
  private authState = inject(AuthStateService);
  private authService = inject(AuthService);

  public menuItems: Menu[] = this.navServices.MENUITEMS;
  public margin: number = 0;
  public width: number = window.innerWidth;
  public leftArrowNone: boolean = true;
  public rightArrowNone: boolean = false;
  public screenWidth: number;
  public screenHeight: number;
  public pined: boolean = false;
  public pinedItem: string[] = [];

  constructor() {
    effect(() => {
      const roles = this.authState.roles();
      const privileges = this.authState.privileges();
      const baseItems = this.navServices.MENUITEMS;
      this.menuItems = this.sidebarService.filterMenu(baseItems as any, roles, privileges) as Menu[];
    });

    this.navServices.item.subscribe((menuItems: Menu[]) => {
      this.menuItems = menuItems;
      this.router.events.subscribe(event => {
        if (event instanceof NavigationEnd) {
          menuItems.filter(items => {
            if (items.path === event.url) {
              this.setNavActive(items);
            }
            if (!items.children) {
              return false;
            }
            items.children.filter((subItems: Menu) => {
              if (subItems.path === event.url) {
                this.setNavActive(subItems);
              }
              if (!subItems.children) {
                return false;
              }
              subItems.children.filter(subSubItems => {
                if (subSubItems.path === event.url) {
                  this.setNavActive(subSubItems);
                }
              });
              return;
            });
            return;
          });
        }
      });
    });
  }

  ngOnInit() {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;
  }

  setNavActive(item: Menu) {
    this.menuItems.filter(menuItem => {
      if (menuItem !== item) {
        menuItem.active = false;
      }
      if (menuItem.children && menuItem.children.includes(item)) {
        menuItem.active = true;
      }
      if (menuItem.children) {
        menuItem.children.filter(submenuItems => {
          if (submenuItems.children && submenuItems.children.includes(item)) {
            menuItem.active = true;
            submenuItems.active = true;
          } else {
            submenuItems.active = false;
          }
        });
      }
    });
  }

  @HostListener('window:resize')
  onResize() {
    this.width = window.innerWidth - 500;
    this.screenWidth = window.innerWidth;
  }

  openMenu() {
    this.navServices.isDisplay = !this.navServices.isDisplay;
  }

  toggleMenu(item: Menu) {
    if (!item.active) {
      this.menuItems.forEach((a: Menu) => {
        if (this.menuItems.includes(item)) {
          a.active = false;
        }
        if (!a.children) {
          return false;
        }
        a.children.forEach((b: Menu) => {
          if (a.children?.includes(item)) {
            b.active = false;
          }
        });
        return;
      });
    }
    item.active = !item.active;
  }

  navigateTo(item: Menu, event: Event): void {
    event.preventDefault();
    event.stopPropagation();

    if (!item.path) {
      return;
    }

    this.router.navigateByUrl(item.path);

    if (window.innerWidth < 992) {
      this.navServices.isDisplay = true;
    }
  }

  isRouteActive(path?: string): boolean {
    return !!path && this.router.url === path;
  }

  scrollToLeft() {
    if (this.margin >= -this.width) {
      this.margin = 0;
      this.leftArrowNone = true;
      this.rightArrowNone = false;
    } else {
      this.margin += this.width;
      this.rightArrowNone = false;
    }
  }

  scrollToRight() {
    if (this.margin <= -3500) {
      this.margin = -3000;
      this.leftArrowNone = false;
      this.rightArrowNone = true;
    } else {
      this.margin += -this.width;
      this.leftArrowNone = false;
    }
  }

  isPined(itemname: string | undefined) {
    return itemname !== undefined && this.pinedItem.includes(itemname);
  }

  togglePined(title: string): void {
    const index = this.pinedItem.indexOf(title);
    if (index !== -1) {
      this.pinedItem.splice(index, 1);
    } else {
      this.pinedItem.push(title);
    }
    if (this.pinedItem.length <= 0) {
      this.pined = false;
    } else {
      this.pined = true;
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
