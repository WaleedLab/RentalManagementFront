import { NgClass, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  DestroyRef,
  HostBinding,
  HostListener,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
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
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  public menuItems: Menu[] = this.navServices.MENUITEMS;
  public margin: number = 0;
  public width: number = window.innerWidth;
  public leftArrowNone: boolean = true;
  public rightArrowNone: boolean = false;
  public screenWidth: number;
  public screenHeight: number;
  public pined: boolean = false;
  public pinedItem: string[] = [];
  /** Title of the only expanded level-1 menu; null = all sections folded. */
  private readonly expandedMenuTitle = signal<string | null>(null);

  constructor() {
    effect(() => {
      const roles = this.authState.roles();
      const privileges = this.authState.privileges();
      const baseItems = this.navServices.MENUITEMS;
      this.menuItems = this.sidebarService.filterMenu(baseItems as any, roles, privileges) as Menu[];
    });

    this.navServices.item.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(menuItems => {
      this.menuItems = menuItems;
    });
  }

  ngOnInit() {
    this.screenWidth = window.innerWidth;
    this.screenHeight = window.innerHeight;

    this.router.events.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(event => {
      if (event instanceof NavigationEnd) {
        this.syncExpandedMenuForUrl(event.urlAfterRedirects);
      }
    });

    this.syncExpandedMenuForUrl(this.router.url);
  }

  isMenuExpanded(item: Menu): boolean {
    const title = item.title?.trim();
    return !!title && this.expandedMenuTitle() === title;
  }


  @HostListener('window:resize')
  onResize() {
    this.width = window.innerWidth - 500;
    this.screenWidth = window.innerWidth;
  }

  openMenu() {
    this.navServices.isDisplay = !this.navServices.isDisplay;
  }

  toggleMenu(item: Menu, event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const title = item.title?.trim();
    if (!title) {
      return;
    }
    this.expandedMenuTitle.update(current => (current === title ? null : title));
    this.syncMenuActiveFlags();
    this.cdr.markForCheck();
  }

  onSidebarNavigated(): void {
    this.syncExpandedMenuForUrl(this.router.url);
    if (window.innerWidth < 992) {
      this.navServices.isDisplay = true;
    }
  }

  /**
   * Keep the level-1 section that contains the current route open; fold the others.
   */
  private syncExpandedMenuForUrl(url: string): void {
    const activeItem = this.findMenuItemByUrl(this.menuItems, url);
    if (!activeItem) {
      this.collapseAllMenus();
      return;
    }

    const parent = this.findLevel1Parent(this.menuItems, activeItem);
    const nextTitle = parent?.title?.trim() ?? activeItem.title?.trim() ?? null;
    this.expandedMenuTitle.set(nextTitle || null);
    this.syncMenuActiveFlags();
    this.cdr.markForCheck();
  }

  private findLevel1Parent(items: Menu[], target: Menu): Menu | null {
    for (const level1 of items) {
      if (level1 === target) {
        return null;
      }
      if (level1.children?.length && this.menuTreeContains(level1, target)) {
        return level1;
      }
    }
    return null;
  }

  private menuTreeContains(root: Menu, target: Menu): boolean {
    if (root === target) {
      return true;
    }
    for (const child of root.children ?? []) {
      if (this.menuTreeContains(child, target)) {
        return true;
      }
    }
    return false;
  }

  private collapseAllMenus(): void {
    this.expandedMenuTitle.set(null);
    this.collapseExpandableMenus();
    this.cdr.markForCheck();
  }

  private syncMenuActiveFlags(items: Menu[] = this.menuItems): void {
    const expanded = this.expandedMenuTitle();
    for (const menuItem of items) {
      if (menuItem.children?.length) {
        menuItem.active = menuItem.title === expanded;
        this.syncMenuActiveFlags(menuItem.children);
      }
    }
  }

  isRouteActive(path?: string): boolean {
    if (!path) {
      return false;
    }
    const activeItem = this.findMenuItemByUrl(this.menuItems, this.router.url);
    return activeItem?.path === path;
  }

  private collapseExpandableMenus(items: Menu[] = this.menuItems): void {
    for (const menuItem of items) {
      if (menuItem.children?.length) {
        menuItem.active = false;
        this.collapseExpandableMenus(menuItem.children);
      }
    }
  }

  private findMenuItemByUrl(items: Menu[], url: string): Menu | null {
    const current = url.split('?')[0];
    let bestMatch: Menu | null = null;
    let bestLength = -1;

    const visit = (nodes: Menu[]): void => {
      for (const node of nodes) {
        if (node.path) {
          const path = node.path;
          const matches = current === path || current.startsWith(`${path}/`);
          if (matches && path.length > bestLength) {
            bestMatch = node;
            bestLength = path.length;
          }
        }
        if (node.children?.length) {
          visit(node.children);
        }
      }
    };

    visit(items);
    return bestMatch;
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
