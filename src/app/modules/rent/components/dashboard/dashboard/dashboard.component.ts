import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { catchError, forkJoin, of } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../../core/interfaces';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import { Menu, NavMenuService } from '../../../../../shared/services/layout/nav-menu.service';
import { Branch, User, Vehicle, VehicleGroupSummary } from '../../../models';
import { BranchService } from '../../../services/branches/branch.service';
import { FleetService } from '../../../services/fleet/fleet.service';
import { PrivilegeService } from '../../../services/privileges/privilege.service';
import { RoleService } from '../../../services/roles/role.service';
import { UserService } from '../../../services/users/user.service';
import { VehicleService } from '../../../services/vehicles/vehicle.service';
import { PageHeaderComponent } from '../../../../../shared/ui/page-header/page-header.component';
import { StatusBadgeComponent } from '../../../../../shared/ui/status-badge/status-badge.component';

interface DashboardShortcutItem {
  title: string;
  path: string;
  imageIcon: string;
}

interface DashboardShortcutSection {
  title: string;
  items: DashboardShortcutItem[];
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, TranslateModule, RouterLink, PageHeaderComponent, StatusBadgeComponent],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private authState = inject(AuthStateService);
  private navMenuService = inject(NavMenuService);
  private userService = inject(UserService);
  private roleService = inject(RoleService);
  private privilegeService = inject(PrivilegeService);
  private fleetService = inject(FleetService);
  private branchService = inject(BranchService);
  private vehicleService = inject(VehicleService);

  loading = signal(false);
  groups = signal<VehicleGroupSummary[]>([]);
  latestUsers = signal<User[]>([]);
  userDistribution = signal({ active: 0, inactive: 0 });
  counts = signal({
    users: 0,
    roles: 0,
    privileges: 0,
    fleets: 0,
    branches: 0,
  });

  totalGroups = computed(() => this.groups().length);
  totalVehicles = computed(() =>
    this.groups().reduce((sum, group) => {
      const groupVehicles = group.categories.reduce((catSum, category) => catSum + (category.vehicleCount ?? 0), 0);
      return sum + groupVehicles;
    }, 0),
  );
  navigationSections = computed(() => this.buildNavigationSections());

  ngOnInit(): void {
    this.loadDashboard();
  }

  private loadDashboard(): void {
    this.loading.set(true);
    const fleetId = this.authState.fleetId() ?? '';
    const emptyPage = <T>(items: T[] = []): PaginatedAggregatorResponse<T> => ({
      items,
      totalCount: items.length,
      pageNumber: 1,
      pageSize: items.length || 1,
      totalPages: items.length > 0 ? 1 : 0,
    });

    forkJoin({
      vehiclesPage: fleetId
        ? this.vehicleService.getPaginated({
            fleetId,
            pageNumber: 1,
            pageSize: 1000,
          }).pipe(catchError(error => of(this.handleDashboardError(error, emptyPage<Vehicle>()))))
        : of(emptyPage<Vehicle>()),
      usersPage: this.userService.getPaginated({ pageNumber: 1, pageSize: 100 }).pipe(
        catchError(error => of(this.handleDashboardError(error, emptyPage<User>()))),
      ),
      roles: this.roleService.getList().pipe(
        catchError(error => of(this.handleDashboardError(error, [] as never[]))),
      ),
      privileges: this.privilegeService.getList().pipe(
        catchError(error => of(this.handleDashboardError(error, [] as never[]))),
      ),
      fleets: this.fleetService.getPaginated({ pageNumber: 1, pageSize: 1 }).pipe(
        catchError(error => of(this.handleDashboardError(error, emptyPage()))),
      ),
      branches: fleetId
        ? this.branchService.getPaginated({ fleetId, pageNumber: 1, pageSize: 1 }).pipe(
            catchError(error => of(this.handleDashboardError(error, emptyPage<Branch>()))),
          )
        : of(emptyPage<Branch>()),
    }).subscribe({
      next: ({ vehiclesPage, usersPage, roles, privileges, fleets, branches }) => {
        this.groups.set(this.buildVehicleGroups(vehiclesPage.items ?? []));

        const paginatedUsers = usersPage.items ?? [];
        if (paginatedUsers.length > 0 || (usersPage.totalCount ?? 0) > 0) {
          this.applyUsersSnapshot(paginatedUsers, usersPage.totalCount ?? paginatedUsers.length);
        } else {
          this.userService.getList('Default').pipe(
            catchError(() =>
              this.userService.getList(undefined).pipe(
                catchError(error => of(this.handleDashboardError(error, []))),
              ),
            ),
          ).subscribe({
            next: users => this.applyUsersSnapshot(users, users.length),
            error: () => this.applyUsersSnapshot([], 0),
          });
        }

        this.counts.update(current => ({
          ...current,
          roles: (roles ?? []).length,
          privileges: (privileges ?? []).length,
          fleets: fleets.totalCount ?? 0,
          branches: branches.totalCount ?? 0,
        }));
      },
      complete: () => this.loading.set(false),
    });
  }

  private handleDashboardError<T>(error: unknown, fallback: T): T {
    return fallback;
  }

  private buildVehicleGroups(items: unknown[]): VehicleGroupSummary[] {
    const grouped = new Map<string, { label: string; count: number }>();

    for (const item of items) {
      const vehicle = item as Record<string, unknown>;
      const rawCategoryId =
        vehicle['categoryVehicleId'] ??
        vehicle['CategoryVehicleId'] ??
        vehicle['idCategoryVehicle'] ??
        vehicle['IdCategoryVehicle'];

      const categoryId = rawCategoryId != null ? String(rawCategoryId) : 'uncategorized';
      const label =
        (vehicle['categoryName'] as string | undefined) ||
        (vehicle['CategoryName'] as string | undefined) ||
        (vehicle['categoryVehicleName'] as string | undefined) ||
        (vehicle['CategoryVehicleName'] as string | undefined) ||
        (categoryId === 'uncategorized' ? 'Uncategorized' : `Category ${categoryId}`);

      const current = grouped.get(categoryId);
      if (current) {
        current.count += 1;
      } else {
        grouped.set(categoryId, { label, count: 1 });
      }
    }

    return Array.from(grouped.entries()).map(([categoryId, entry]) => ({
      groupName: entry.label,
      categories: [
        {
          categoryName: categoryId === 'uncategorized' ? 'Uncategorized' : entry.label,
          vehicleCount: entry.count,
        },
      ],
    }));
  }

  private applyUsersSnapshot(users: User[], totalCount: number): void {
    this.latestUsers.set(users.slice(0, 5));
    this.userDistribution.set({
      active: users.filter(user => user.isActive).length,
      inactive: users.filter(user => !user.isActive).length,
    });
    this.counts.update(current => ({
      ...current,
      users: totalCount,
    }));
  }

  private buildNavigationSections(): DashboardShortcutSection[] {
    const sections: DashboardShortcutSection[] = [];
    let currentSectionTitle: string | null = null;

    for (const item of this.navMenuService.MENUITEMS) {
      if (item.headTitle1) {
        currentSectionTitle = item.headTitle1;
        continue;
      }

      if (!currentSectionTitle) {
        continue;
      }

      const shortcuts = this.extractShortcutItems(item);
      if (shortcuts.length === 0) {
        continue;
      }

      let section = sections.find(entry => entry.title === currentSectionTitle);
      if (!section) {
        section = {
          title: currentSectionTitle,
          items: [],
        };
        sections.push(section);
      }

      section.items.push(...shortcuts);
    }

    return sections;
  }

  private extractShortcutItems(item: Menu): DashboardShortcutItem[] {
    if (!this.canAccessMenuItem(item)) {
      return [];
    }

    if (item.type === 'sub') {
      return (item.children ?? [])
        .filter(child => this.canAccessMenuItem(child))
        .filter((child): child is Menu & { path: string; title: string; imageIcon: string } =>
          !!child.path && !!child.title && !!child.imageIcon,
        )
        .map(child => ({
          title: child.title,
          path: child.path,
          imageIcon: child.imageIcon,
        }));
    }

    if (!item.path || !item.title || !item.imageIcon) {
      return [];
    }

    return [
      {
        title: item.title,
        path: item.path,
        imageIcon: item.imageIcon,
      },
    ];
  }

  private canAccessMenuItem(item: Menu): boolean {
    return this.authState.hasAnyRole(item.roles ?? []) && this.authState.hasAnyPrivilege(item.privileges ?? []);
  }
}





