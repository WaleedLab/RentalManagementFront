import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

import { ADMIN_ROLES } from '../../../../../core/auth/access.constants';
import { AuthStateService } from '../../../../../core/auth/auth-state.service';
import {
  AccessLevel,
  PrivilegeDisplayItem,
  SECURITY_ACCESS_AREAS,
  SECURITY_SEARCH_MIN_ITEMS,
  filterPrivilegeGroups,
  filterRoles,
  groupPrivilegesByDomain,
  hasAccessArea,
  parsePrivilegeParts,
  resolveAccessLevel,
  resolveActionMeta,
  resolveDomainMeta,
  resolveRoleDisplay,
} from '../security-access.util';

@Component({
  selector: 'app-security-overview',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslateModule, RouterLink],
  templateUrl: './security-overview.component.html',
  styleUrl: './security-overview.component.scss',
})
export class SecurityOverviewComponent implements OnInit {
  private static readonly WORKFLOW_SECTION_IDS = [
    'security-overview-section-privileges',
    'security-overview-section-roles',
    'security-overview-section-access',
    'security-overview-section-account',
  ] as const;

  readonly searchMinItems = SECURITY_SEARCH_MIN_ITEMS;

  private readonly hostEl = inject(ElementRef<HTMLElement>);
  private authState = inject(AuthStateService);
  private translate = inject(TranslateService);

  userName = signal<string | null>(null);
  displayName = signal<string | null>(null);
  displayNameEn = signal<string | null>(null);
  email = signal<string | null>(null);
  roles = signal<string[]>([]);
  privileges = signal<string[]>([]);
  roleSearch = signal('');
  privilegeSearch = signal('');

  canManageRoles = computed(() =>
    this.authState.hasAnyPrivilege(['viewrole', 'security_manage', 'role_manage', 'roles_manage']),
  );

  canManagePrivileges = computed(() =>
    this.authState.hasAnyPrivilege(['viewprivilege', 'security_manage', 'privilege_manage', 'privileges_manage']),
  );

  roleItems = computed(() => this.roles().map(resolveRoleDisplay));

  privilegeGroups = computed(() => groupPrivilegesByDomain(this.privileges()));

  filteredPrivilegeGroups = computed(() =>
    filterPrivilegeGroups(this.privilegeGroups(), this.privilegeSearch()),
  );

  filteredRoleItems = computed(() => filterRoles(this.roleItems(), this.roleSearch()));

  rolesCount = computed(() => this.roles().length);
  privilegesCount = computed(() => this.privileges().length);

  showRoleSearch = computed(() => this.rolesCount() >= this.searchMinItems);
  showPrivilegeSearch = computed(() => this.privilegesCount() >= this.searchMinItems);

  accessibleAreas = computed(() =>
    SECURITY_ACCESS_AREAS.filter(area => hasAccessArea(area, this.privileges(), this.roles())),
  );

  deniedAreas = computed(() =>
    SECURITY_ACCESS_AREAS.filter(area => !hasAccessArea(area, this.privileges(), this.roles())),
  );

  accessLevel = computed((): AccessLevel => {
    if (this.isAdminLike()) {
      return 'full';
    }

    return resolveAccessLevel(this.privilegesCount(), this.rolesCount());
  });

  privilegesSectionReady = computed(() => this.privilegesCount() > 0);
  rolesSectionReady = computed(() => this.rolesCount() > 0);
  accessSectionReady = computed(() => this.accessibleAreas().length > 0);

  currentWorkflowStep = computed(() => {
    if (!this.privilegesSectionReady()) return 1;
    if (!this.rolesSectionReady()) return 2;
    if (!this.accessSectionReady()) return 3;
    return 4;
  });

  ngOnInit(): void {
    const user = this.authState.currentUser();

    this.userName.set(user?.username ?? user?.name ?? null);
    this.displayName.set(user?.name ?? null);
    this.displayNameEn.set(user?.nameEn ?? null);
    this.email.set(user?.email ?? null);
    this.roles.set(user?.roles ?? []);
    this.privileges.set(user?.privileges ?? []);
  }

  focusWorkflowSection(step: 1 | 2 | 3 | 4): void {
    const sectionId = SecurityOverviewComponent.WORKFLOW_SECTION_IDS[step - 1];
    const section = this.hostEl.nativeElement.querySelector(
      `#${sectionId}`,
    ) as HTMLDetailsElement | null;
    if (!section) {
      return;
    }

    section.open = true;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    section.classList.add('security-overview-section--focus');
    window.setTimeout(() => section.classList.remove('security-overview-section--focus'), 1400);
  }

  privilegeLabel(item: PrivilegeDisplayItem): string {
    if (item.labelKey !== 'security.privilege.dynamic') {
      const translated = this.translate.instant(item.labelKey);
      return translated !== item.labelKey ? translated : item.labelFallback;
    }

    const { domainId, action } = parsePrivilegeParts(item.code);
    const domainMeta = resolveDomainMeta(domainId);
    const domain = this.areaLabel(domainMeta.domainKey, domainMeta.domainFallback);
    const actionMeta = resolveActionMeta(action);
    if (actionMeta) {
      const actionLabel = this.areaLabel(actionMeta.key, actionMeta.fallback);
      return `${actionLabel} ${domain}`;
    }

    return item.labelFallback;
  }

  roleDescription(item: ReturnType<typeof resolveRoleDisplay>): string {
    const translated = this.translate.instant(item.descriptionKey);
    return translated !== item.descriptionKey ? translated : item.descriptionFallback;
  }

  accessLevelLabel(level: AccessLevel): string {
    return this.translate.instant(`security.accessLevel.${level}`);
  }

  areaLabel(labelKey: string, fallback: string): string {
    const translated = this.translate.instant(labelKey);
    return translated !== labelKey ? translated : fallback;
  }

  domainLabel(domainKey: string, fallback: string): string {
    return this.areaLabel(domainKey, fallback);
  }

  private isAdminLike(): boolean {
    const normalizedRoles = this.roles().map(role => role.trim().toLowerCase());
    return ADMIN_ROLES.some(role => normalizedRoles.includes(role.trim().toLowerCase()));
  }
}
