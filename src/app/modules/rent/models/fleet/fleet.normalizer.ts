import { Fleet } from './fleet.model';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

function normalizeFleetImageUrl(raw?: string | null): string | undefined {
  if (!raw) {
    return undefined;
  }

  let trimmed = String(raw).trim().replace(/\\/g, '/');
  if (!trimmed) {
    return undefined;
  }

  trimmed = trimmed.replace(/\/Api\/uploads\//gi, '/uploads/');
  trimmed = trimmed.replace(/^Api\/uploads\//i, '/uploads/');

  if (/^data:image\//i.test(trimmed) || /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/uploads/')) {
    return trimmed;
  }

  const withoutLeading = trimmed.replace(/^\/+/, '');
  if (/^files\/fleet\//i.test(withoutLeading)) {
    return `/uploads/fleet/${withoutLeading.slice('files/fleet/'.length)}`;
  }
  if (/^files\//i.test(withoutLeading)) {
    return `/${withoutLeading.replace(/^files\//i, 'uploads/')}`;
  }
  if (/^uploads\/fleet\//i.test(withoutLeading)) {
    return `/${withoutLeading}`;
  }
  if (/^fleet\//i.test(withoutLeading)) {
    return `/uploads/${withoutLeading}`;
  }
  if (!/[\\/]/.test(withoutLeading) && /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(withoutLeading)) {
    return `/uploads/fleet/${withoutLeading}`;
  }

  return trimmed.startsWith('/') ? trimmed : `/${withoutLeading}`;
}

export function normalizeFleet(raw: unknown): Fleet {
  const source = (raw ?? {}) as Record<string, unknown>;
  const rawUrl = pick<string>(source, 'url', 'Url', 'URL');
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    name: String(pick(source, 'name', 'Name') ?? ''),
    description: pick<string>(source, 'description', 'Description'),
    fleetCode: pick<string>(source, 'fleetCode', 'FleetCode'),
    taxNumber: pick<string>(source, 'taxNumber', 'TaxNumber'),
    url: normalizeFleetImageUrl(rawUrl),
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
