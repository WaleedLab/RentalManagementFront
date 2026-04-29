import { Branch } from './branch.model';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

export function normalizeBranch(raw: unknown): Branch {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: Number(pick(source, 'id', 'Id') ?? 0),
    fleetId: String(pick(source, 'fleetId', 'FleetId') ?? ''),
    nameAr: String(pick(source, 'nameAr', 'NameAr') ?? ''),
    nameEn: pick<string>(source, 'nameEn', 'NameEn'),
    code: pick<string>(source, 'code', 'Code'),
    street: pick<string>(source, 'street', 'Street'),
    neighborHood: pick<string>(source, 'neighborHood', 'NeighborHood'),
    buldingNumber: pick<string>(source, 'buldingNumber', 'BuldingNumber'),
    city: pick<string>(source, 'city', 'City'),
    contactNumber: pick<string>(source, 'contactNumber', 'ContactNumber'),
    isActive: Boolean(pick(source, 'isActive', 'IsActive') ?? false),
    createdBy: pick<string>(source, 'createdBy', 'CreatedBy'),
    updatedBy: pick<string>(source, 'updatedBy', 'UpdatedBy'),
    createdAt: pick<string>(source, 'createdAt', 'CreatedAt'),
    updatedAt: pick<string>(source, 'updatedAt', 'UpdatedAt'),
    deletedBy: pick<string>(source, 'deletedBy', 'DeletedBy'),
    deletedAt: pick<string>(source, 'deletedAt', 'DeletedAt'),
    isDeleted: pick<boolean>(source, 'isDeleted', 'IsDeleted'),
  };
}
