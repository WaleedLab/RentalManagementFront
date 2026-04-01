import { CustomerSubscription } from './customer-subscription.model';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

export function normalizeCustomerSubscription(raw: unknown): CustomerSubscription {
  const source = (raw ?? {}) as Record<string, unknown>;

  return {
    id: Number(pick(source, 'id', 'Id') ?? 0),
    nameAr: String(pick(source, 'nameAr', 'NameAr') ?? ''),
    nameEn: pick<string>(source, 'nameEn', 'NameEn'),
    description: pick<string>(source, 'description', 'Description'),
    discount: Number(pick(source, 'discount', 'Discount') ?? 0),
    isOld: Boolean(pick(source, 'isOld', 'IsOld') ?? false),
    subscriptionApprovedAfter: Number(
      pick(source, 'subscriptionApprovedAfter', 'SubscriptionApprovedAfter') ?? 0,
    ),
    fleetId: pick<string>(source, 'fleetId', 'FleetId'),
  };
}

