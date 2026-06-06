export interface PrivilegeDisplayItem {
  code: string;
  labelKey: string;
  labelFallback: string;
}

export interface PrivilegeDomainGroup {
  domainId: string;
  domainKey: string;
  domainFallback: string;
  items: PrivilegeDisplayItem[];
}

export interface RoleDisplayItem {
  name: string;
  descriptionKey: string;
  descriptionFallback: string;
}

export interface AccessAreaItem {
  id: string;
  labelKey: string;
  labelFallback: string;
  privilegeCodes: string[];
  privilegePrefixes?: string[];
  roleNames: string[];
}

export type AccessLevel = 'full' | 'medium' | 'limited';

export const SECURITY_SEARCH_MIN_ITEMS = 10;

const PRIVILEGE_LABEL_KEYS: Record<string, string> = {
  BOOKING_MANAGE: 'security.privilege.BOOKING_MANAGE',
  CUSTOMER_MANAGE: 'security.privilege.CUSTOMER_MANAGE',
  VEHICLE_MANAGE: 'security.privilege.VEHICLE_MANAGE',
  FINANCIAL_REPORTS: 'security.privilege.FINANCIAL_REPORTS',
  SECURITY_MANAGE: 'security.privilege.SECURITY_MANAGE',
  USER_MANAGE: 'security.privilege.USER_MANAGE',
  ROLE_MANAGE: 'security.privilege.ROLE_MANAGE',
  PRIVILEGE_MANAGE: 'security.privilege.PRIVILEGE_MANAGE',
};

const DOMAIN_LABEL_KEYS: Record<string, { key: string; fallback: string }> = {
  BOOKING: { key: 'security.domain.BOOKING', fallback: 'Bookings' },
  CUSTOMER: { key: 'security.domain.CUSTOMERS', fallback: 'Customers' },
  VEHICLE: { key: 'security.domain.VEHICLES', fallback: 'Vehicles' },
  MAINTENANCE: { key: 'security.domain.MAINTENANCE', fallback: 'Maintenance' },
  PAYMENT_COUNT: { key: 'security.domain.PAYMENT_COUNTS', fallback: 'Payment counts' },
  PAYMENT: { key: 'security.domain.PAYMENT_COUNTS', fallback: 'Payment counts' },
  BANK: { key: 'security.domain.BANKS', fallback: 'Banks' },
  CASH: { key: 'security.domain.CASH', fallback: 'Cash accounts' },
  COUNTING: { key: 'security.domain.COUNTING', fallback: 'Chart of accounts' },
  JOURNAL: { key: 'security.domain.JOURNALS', fallback: 'Journals' },
  FINANCIAL_YEAR: { key: 'security.domain.FINANCIAL_YEARS', fallback: 'Financial years' },
  FINANCIAL: { key: 'security.domain.REPORTS', fallback: 'Reports' },
  FLEET: { key: 'security.domain.FLEET', fallback: 'Fleet' },
  BRANCH: { key: 'security.domain.BRANCHES', fallback: 'Branches' },
  USER: { key: 'security.domain.USERS', fallback: 'Users' },
  ROLE: { key: 'security.domain.ROLES', fallback: 'Roles' },
  PRIVILEGE: { key: 'security.domain.PRIVILEGES', fallback: 'Privileges' },
  SECURITY: { key: 'security.domain.SECURITY', fallback: 'Security' },
  SETTINGS: { key: 'security.domain.SETTINGS', fallback: 'Settings' },
  OTHER: { key: 'security.domain.OTHER', fallback: 'Other' },
};

const ACTION_LABEL_KEYS: Record<string, { key: string; fallback: string }> = {
  MANAGE: { key: 'security.action.MANAGE', fallback: 'Manage' },
  READ: { key: 'security.action.READ', fallback: 'View' },
  CREATE: { key: 'security.action.CREATE', fallback: 'Create' },
  UPDATE: { key: 'security.action.UPDATE', fallback: 'Update' },
  DELETE: { key: 'security.action.DELETE', fallback: 'Delete' },
};

export function resolveActionMeta(action: string | null): { key: string; fallback: string } | null {
  if (!action) {
    return null;
  }

  return ACTION_LABEL_KEYS[action] ?? null;
}

export const SECURITY_ACCESS_AREAS: AccessAreaItem[] = [
  {
    id: 'booking',
    labelKey: 'Booking',
    labelFallback: 'Bookings',
    privilegeCodes: ['BOOKING_MANAGE'],
    roleNames: [],
  },
  {
    id: 'customers',
    labelKey: 'Customers',
    labelFallback: 'Customers',
    privilegeCodes: ['CUSTOMER_MANAGE'],
    roleNames: [],
  },
  {
    id: 'vehicles',
    labelKey: 'Vehicles',
    labelFallback: 'Vehicles',
    privilegeCodes: ['VEHICLE_MANAGE'],
    roleNames: [],
  },
  {
    id: 'maintenance',
    labelKey: 'maintenance.menuTitle',
    labelFallback: 'Maintenance',
    privilegeCodes: ['VEHICLE_MANAGE'],
    roleNames: [],
  },
  {
    id: 'finance',
    labelKey: 'Finance',
    labelFallback: 'Finance',
    privilegeCodes: ['FINANCIAL_REPORTS'],
    privilegePrefixes: ['BANK_', 'CASH_', 'COUNTING_', 'JOURNAL_', 'FINANCIAL_YEAR_', 'PAYMENT_COUNT_'],
    roleNames: [],
  },
  {
    id: 'reports',
    labelKey: 'security.accessArea.reports',
    labelFallback: 'Financial reports',
    privilegeCodes: ['FINANCIAL_REPORTS'],
    roleNames: [],
  },
  {
    id: 'users',
    labelKey: 'Users',
    labelFallback: 'User management',
    privilegeCodes: ['USER_MANAGE', 'USERS_MANAGE', 'SECURITY_MANAGE'],
    roleNames: ['admin', 'Admin', 'مدير', 'super_admin', 'System Admin'],
  },
  {
    id: 'settings',
    labelKey: 'Settings',
    labelFallback: 'System settings',
    privilegeCodes: ['SECURITY_MANAGE', 'SETTINGS_MANAGE'],
    roleNames: ['admin', 'Admin', 'مدير', 'super_admin', 'System Admin'],
  },
];

const ROLE_DESCRIPTION_KEYS: Record<string, string> = {
  admin: 'security.roleDesc.admin',
  'super_admin': 'security.roleDesc.admin',
  'super admin': 'security.roleDesc.admin',
  'system admin': 'security.roleDesc.admin',
  'systemadministrator_role': 'security.roleDesc.admin',
  manager: 'security.roleDesc.manager',
  fleetmanager_role: 'security.roleDesc.manager',
  groupmanager_role: 'security.roleDesc.manager',
  مدير: 'security.roleDesc.admin',
};

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

export function parsePrivilegeParts(code: string): { domainId: string; action: string | null } {
  const normalized = code.trim().toUpperCase();
  const parts = normalized.split('_').filter(Boolean);
  if (parts.length === 0) {
    return { domainId: 'OTHER', action: null };
  }

  const last = parts[parts.length - 1];
  if (ACTION_LABEL_KEYS[last]) {
    const domainParts = parts.slice(0, -1);
    return {
      domainId: domainParts.length > 0 ? domainParts.join('_') : 'OTHER',
      action: last,
    };
  }

  return { domainId: parts.join('_'), action: null };
}

export function resolveDomainMeta(domainId: string): { domainKey: string; domainFallback: string } {
  const direct = DOMAIN_LABEL_KEYS[domainId];
  if (direct) {
    return { domainKey: direct.key, domainFallback: direct.fallback };
  }

  const firstToken = domainId.split('_')[0] ?? 'OTHER';
  const fallbackEntry = DOMAIN_LABEL_KEYS[firstToken] ?? DOMAIN_LABEL_KEYS['OTHER'];
  return { domainKey: fallbackEntry.key, domainFallback: fallbackEntry.fallback };
}

function buildPrivilegeFallback(code: string, domainId: string, action: string | null): string {
  const domainMeta = resolveDomainMeta(domainId);
  if (!action) {
    return code.replace(/_/g, ' ');
  }

  const actionMeta = ACTION_LABEL_KEYS[action];
  if (!actionMeta) {
    return code.replace(/_/g, ' ');
  }

  return `${actionMeta.fallback} ${domainMeta.domainFallback}`;
}

export function resolvePrivilegeDisplay(code: string): PrivilegeDisplayItem {
  const normalized = code.trim().toUpperCase();
  const knownKey = PRIVILEGE_LABEL_KEYS[normalized];
  if (knownKey) {
    return {
      code: normalized,
      labelKey: knownKey,
      labelFallback: normalized.replace(/_/g, ' '),
    };
  }

  const { domainId, action } = parsePrivilegeParts(normalized);
  const domainMeta = resolveDomainMeta(domainId);
  if (action) {
    const actionMeta = ACTION_LABEL_KEYS[action];
    return {
      code: normalized,
      labelKey: 'security.privilege.dynamic',
      labelFallback: `${actionMeta?.fallback ?? action} ${domainMeta.domainFallback}`,
    };
  }

  return {
    code: normalized,
    labelKey: 'security.privilege.dynamic',
    labelFallback: buildPrivilegeFallback(normalized, domainId, action),
  };
}

export function groupPrivilegesByDomain(codes: string[]): PrivilegeDomainGroup[] {
  const groups = new Map<string, PrivilegeDomainGroup>();

  for (const rawCode of codes) {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      continue;
    }

    const item = resolvePrivilegeDisplay(code);
    const { domainId } = parsePrivilegeParts(code);
    const domainMeta = resolveDomainMeta(domainId);
    const existing = groups.get(domainId);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(domainId, {
      domainId,
      domainKey: domainMeta.domainKey,
      domainFallback: domainMeta.domainFallback,
      items: [item],
    });
  }

  return Array.from(groups.values())
    .map(group => ({
      ...group,
      items: [...group.items].sort((a, b) => a.code.localeCompare(b.code)),
    }))
    .sort((a, b) => a.domainFallback.localeCompare(b.domainFallback));
}

export function resolveRoleDisplay(name: string): RoleDisplayItem {
  const normalized = normalizeToken(name);
  const descriptionKey = ROLE_DESCRIPTION_KEYS[normalized] ?? 'security.roleDesc.default';
  return {
    name,
    descriptionKey,
    descriptionFallback: 'Assigned role for the current session.',
  };
}

export function matchesPrivilege(code: string, userPrivileges: string[]): boolean {
  const normalizedCode = code.trim().toUpperCase();
  const normalizedUser = userPrivileges.map(item => item.trim().toUpperCase());
  if (normalizedUser.includes(normalizedCode)) {
    return true;
  }

  const prefix = normalizedCode.replace(/_MANAGE$/, '');
  return normalizedUser.some(item => item.startsWith(`${prefix}_`));
}

export function hasAccessArea(
  area: AccessAreaItem,
  userPrivileges: string[],
  userRoles: string[],
): boolean {
  const normalizedRoles = userRoles.map(normalizeToken);
  if (area.roleNames.some(role => normalizedRoles.includes(normalizeToken(role)))) {
    return true;
  }

  if (area.privilegeCodes.some(code => matchesPrivilege(code, userPrivileges))) {
    return true;
  }

  const prefixes = area.privilegePrefixes ?? [];
  const normalizedUser = userPrivileges.map(item => item.trim().toUpperCase());
  return prefixes.some(prefix =>
    normalizedUser.some(item => item.startsWith(prefix.toUpperCase())),
  );
}

export function resolveAccessLevel(privilegeCount: number, roleCount: number): AccessLevel {
  if (privilegeCount >= 12 || roleCount >= 2) {
    return 'full';
  }

  if (privilegeCount >= 4 || roleCount >= 1) {
    return 'medium';
  }

  return 'limited';
}

export function filterPrivilegeGroups(
  groups: PrivilegeDomainGroup[],
  term: string,
): PrivilegeDomainGroup[] {
  const keyword = term.trim().toLowerCase();
  if (!keyword) {
    return groups;
  }

  return groups
    .map(group => ({
      ...group,
      items: group.items.filter(
        item =>
          item.code.toLowerCase().includes(keyword) ||
          item.labelFallback.toLowerCase().includes(keyword),
      ),
    }))
    .filter(group => group.items.length > 0);
}

export function filterRoles(items: RoleDisplayItem[], term: string): RoleDisplayItem[] {
  const keyword = term.trim().toLowerCase();
  if (!keyword) {
    return items;
  }

  return items.filter(
    item =>
      item.name.toLowerCase().includes(keyword) ||
      item.descriptionFallback.toLowerCase().includes(keyword),
  );
}
