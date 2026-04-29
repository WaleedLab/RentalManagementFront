import { Fleet } from './fleet.model';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

export function normalizeFleet(raw: unknown): Fleet {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    name: String(pick(source, 'name', 'Name') ?? ''),
    description: pick<string>(source, 'description', 'Description'),
    fleetCode: pick<string>(source, 'fleetCode', 'FleetCode'),
    taxNumber: pick<string>(source, 'taxNumber', 'TaxNumber'),
    url: pick<string>(source, 'url', 'Url', 'URL'),
    imageExtension: pick<string>(source, 'imageExtension', 'ImageExtension'),
    isActive: Boolean(pick(source, 'isActive', 'IsActive') ?? false),
    location: pick<string>(source, 'location', 'Location'),
    contactNumber: pick<string>(source, 'contactNumber', 'ContactNumber'),
    email: pick<string>(source, 'email', 'Email'),
    createdBy: pick<string>(source, 'createdBy', 'CreatedBy'),
    updatedBy: pick<string>(source, 'updatedBy', 'UpdatedBy'),
    createdAt: pick<string>(source, 'createdAt', 'CreatedAt'),
    updatedAt: pick<string>(source, 'updatedAt', 'UpdatedAt'),
    deletedBy: pick<string>(source, 'deletedBy', 'DeletedBy'),
    deletedAt: pick<string>(source, 'deletedAt', 'DeletedAt'),
    isDeleted: pick<boolean>(source, 'isDeleted', 'IsDeleted'),
  };
}
