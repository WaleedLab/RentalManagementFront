import { Injectable, computed, inject, signal } from '@angular/core';

import { TokenService } from '../../shared/services/storage/token.service';
import { CurrentUser } from './current-user.model';

interface AuthSessionState {
  token: string | null;
  user: CurrentUser | null;
}

const SESSION_RESTORE_GRACE_PERIOD_MS = 5 * 60 * 1000;

const ADMIN_ROLE_ALIASES = [
  'admin',
  'super_admin',
  'super admin',
  'systemadministrator_role',
  'system administrator',
  'manager',
  'fleetmanager_role',
  'groupmanager_role',
  'مدير',
];

const PRIVILEGE_ALIASES: Record<string, string[]> = {
  viewuser: ['user_manage', 'users_manage', 'security_manage'],
  createuser: ['user_manage', 'users_manage', 'security_manage'],
  updateuser: ['user_manage', 'users_manage', 'security_manage'],
  deleteuser: ['user_manage', 'users_manage', 'security_manage'],
  viewrole: ['security_manage', 'role_manage', 'roles_manage'],
  createrole: ['security_manage', 'role_manage', 'roles_manage'],
  updaterole: ['security_manage', 'role_manage', 'roles_manage'],
  deleterole: ['security_manage', 'role_manage', 'roles_manage'],
  viewprivilege: ['security_manage', 'privilege_manage', 'privileges_manage'],
  createprivilege: ['security_manage', 'privilege_manage', 'privileges_manage'],
  updateprivilege: ['security_manage', 'privilege_manage', 'privileges_manage'],
  deleteprivilege: ['security_manage', 'privilege_manage', 'privileges_manage'],
  viewfleet: ['fleet_manage', 'vehicle_manage'],
  createfleet: ['fleet_manage', 'vehicle_manage'],
  updatefleet: ['fleet_manage', 'vehicle_manage'],
  deletefleet: ['fleet_manage', 'vehicle_manage'],
  viewbranch: ['branch_manage', 'fleet_manage', 'vehicle_manage'],
  createbranch: ['branch_manage', 'fleet_manage', 'vehicle_manage'],
  updatebranch: ['branch_manage', 'fleet_manage', 'vehicle_manage'],
  deletebranch: ['branch_manage', 'fleet_manage', 'vehicle_manage'],
  viewvehicle: ['vehicle_manage'],
  createvehicle: ['vehicle_manage'],
  updatevehicle: ['vehicle_manage'],
  deletevehicle: ['vehicle_manage'],
  viewcategoryvehicle: ['vehicle_manage'],
  createcategoryvehicle: ['vehicle_manage'],
  updatecategoryvehicle: ['vehicle_manage'],
  deletecategoryvehicle: ['vehicle_manage'],
  viewcustomer: ['customer_manage'],
  createcustomer: ['customer_manage'],
  updatecustomer: ['customer_manage'],
  deletecustomer: ['customer_manage'],
  viewbooking: ['booking_manage'],
  createbooking: ['booking_manage'],
  updatebooking: ['booking_manage'],
  deletebooking: ['booking_manage'],
  financialreports: ['financial_reports'],
};

@Injectable({
  providedIn: 'root',
})
export class AuthStateService {
  private tokenService = inject(TokenService);

  private readonly state = signal<AuthSessionState>({
    token: null,
    user: null,
  });

  readonly token = computed(() => this.state().token);
  readonly currentUser = computed(() => this.state().user);
  readonly roles = computed(() => this.state().user?.roles ?? []);
  readonly privileges = computed(() => this.state().user?.privileges ?? []);
  readonly fleetId = computed(() => this.state().user?.fleetId ?? this.tokenService.getFleetId() ?? null);
  readonly branchId = computed(() => this.state().user?.branchId ?? null);
  readonly isAuthenticated = computed(() => !!this.state().token);

  constructor() {
    this.registerCloseTracking();
    this.restoreSession();
  }

  restoreSession(): void {
    const token = this.tokenService.getToken();
    if (!token) {
      this.clearSession(false);
      return;
    }

    if (this.tokenService.isTokenExpired(token) || this.isClosedBeyondGracePeriod()) {
      this.clearSession();
      return;
    }

    const user = this.parseCurrentUser(token);
    if (!user) {
      this.clearSession();
      return;
    }

    this.tokenService.clearClosedAt();
    this.state.set({ token, user });
    this.persistDerivedClaims(user);
  }

  createSession(token: string): CurrentUser | null {
    const user = this.parseCurrentUser(token);
    if (!user) {
      this.clearSession();
      return null;
    }

    this.tokenService.setToken(token);
    this.persistDerivedClaims(user);
    this.state.set({ token, user });
    return user;
  }

  clearSession(clearStorage: boolean = true): void {
    if (clearStorage) {
      this.tokenService.removeToken();
    }

    this.state.set({
      token: null,
      user: null,
    });
  }

  hasRole(role: string): boolean {
    const required = role.toLowerCase().trim();
    return this.roles().some(item => item.toLowerCase().trim() === required);
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.length === 0 || roles.some(role => this.hasRole(role));
  }

  hasPrivilege(privilege: string): boolean {
    const required = privilege.toLowerCase().trim();
    if (this.isAdminLikeUser()) {
      return true;
    }

    const userPrivileges = this.privileges().map(item => item.toLowerCase().trim());
    if (userPrivileges.includes(required)) {
      return true;
    }

    const aliases = PRIVILEGE_ALIASES[required] ?? [];
    return aliases.some(alias => userPrivileges.includes(alias));
  }

  hasAnyPrivilege(privileges: string[]): boolean {
    return privileges.length === 0 || privileges.some(privilege => this.hasPrivilege(privilege));
  }

  private parseCurrentUser(token: string): CurrentUser | null {
    const payload = this.tokenService.decodePayload(token) as Record<string, unknown> | null;
    if (!payload) {
      return null;
    }

    const fleetId =
      this.readClaim(payload, ['fleetId', 'FleetId', 'fleetID', 'FleetID', 'fleetid', 'fleet_id']) ??
      this.tokenService.getFleetId();

    return {
      id: this.readClaim(payload, ['id', 'Id', 'nameid', 'sub']),
      username: this.readClaim(payload, ['username', 'userName', 'unique_name']),
      name: this.readClaim(payload, ['name', 'fullName', 'Name']),
      nameEn: this.readClaim(payload, ['nameEn', 'NameEn']),
      email: this.readClaim(payload, ['email', 'Email']),
      branchId: this.readClaim(payload, ['branchId', 'BranchId', 'branchID', 'BranchID', 'branchid', 'branch_id']),
      fleetId,
      roles: this.readClaimArray(payload, [
        'roles',
        'role',
        'http://schemas.microsoft.com/ws/2008/06/identity/claims/role',
        'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role',
      ]),
      privileges: this.readClaimArray(payload, ['privilege', 'privileges']),
      rawClaims: payload,
    };
  }

  private readClaim(payload: Record<string, unknown>, keys: string[]): string | null {
    for (const key of keys) {
      const value = payload[key];
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        return String(value);
      }
    }

    return null;
  }

  private readClaimArray(payload: Record<string, unknown>, keys: string[]): string[] {
    const values = new Set<string>();

    for (const key of keys) {
      const parsed = this.parseClaimArray(payload[key]);
      for (const item of parsed) {
        values.add(item);
      }
    }

    return Array.from(values);
  }

  private parseClaimArray(value: unknown): string[] {
    if (Array.isArray(value)) {
      return value.map(item => String(item).trim()).filter(Boolean);
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (!trimmed) {
        return [];
      }

      if (trimmed.startsWith('[')) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed)
            ? parsed.map(item => String(item).trim()).filter(Boolean)
            : [];
        } catch {
          return [];
        }
      }

      return trimmed
        .split(/[,;]/)
        .map(item => item.trim())
        .filter(Boolean);
    }

    return [];
  }

  private persistDerivedClaims(user: CurrentUser): void {
    localStorage.setItem('roles', JSON.stringify(user.roles));
    localStorage.setItem('privileges', JSON.stringify(user.privileges));

    if (user.fleetId) {
      localStorage.setItem('fleetId', user.fleetId);
    } else {
      localStorage.removeItem('fleetId');
    }
  }

  private isAdminLikeUser(): boolean {
    const roles = this.roles().map(role => role.toLowerCase().trim());
    return roles.some(role => ADMIN_ROLE_ALIASES.includes(role));
  }

  private registerCloseTracking(): void {
    if (typeof window === 'undefined') {
      return;
    }

    const persistCloseTime = () => {
      if (this.state().token) {
        this.tokenService.markClosedAt();
      }
    };

    window.addEventListener('pagehide', persistCloseTime);
    window.addEventListener('beforeunload', persistCloseTime);
  }

  private isClosedBeyondGracePeriod(): boolean {
    const closedAt = this.tokenService.getClosedAt();
    if (!closedAt) {
      return false;
    }

    return Date.now() - closedAt > SESSION_RESTORE_GRACE_PERIOD_MS;
  }
}
