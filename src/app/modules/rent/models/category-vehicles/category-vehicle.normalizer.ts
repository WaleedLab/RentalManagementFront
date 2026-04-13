import { CategoryVehicle } from './category-vehicle.model';

function pick<T>(source: Record<string, unknown>, ...keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in source && source[key] !== undefined && source[key] !== null) {
      return source[key] as T;
    }
  }
  return undefined;
}

export function normalizeCategoryVehicle(raw: unknown): CategoryVehicle {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    fleetId: String(pick(source, 'fleetId', 'FleetId') ?? ''),
    nameAr: String(pick(source, 'nameAr', 'NameAr') ?? ''),
    nameEn: pick<string>(source, 'nameEn', 'NameEn'),
    code: pick<string>(source, 'code', 'Code'),
    description: pick<string>(source, 'description', 'Description'),
    imageUrl: pick<string>(source, 'imageUrl', 'ImageUrl', 'url', 'Url'),
    isActive: !Boolean(pick(source, 'isDeleted', 'IsDeleted') ?? false),
    price_day_low: pick<number>(source, 'price_day_low', 'Price_day_low'),
    price_day_high: pick<number>(source, 'price_day_high', 'Price_day_high'),
    price_month_low: pick<number>(source, 'price_month_low', 'Price_month_low'),
    price_month_high: pick<number>(source, 'price_month_high', 'Price_month_high'),
    priceHoureExtraLow: pick<number>(source, 'priceHoureExtraLow', 'PriceHoureExtraLow'),
    priceHoureExtraHigh: pick<number>(source, 'priceHoureExtraHigh', 'PriceHoureExtraHigh'),
    priceKmExtraLow: pick<number>(
      source,
      'priceKmExtraLow',
      'PriceKmExtraLow',
      'price_km_extra_low',
      'Price_km_extra_low',
    ),
    priceKmExtraHigh: pick<number>(
      source,
      'priceKmExtraHigh',
      'PriceKmExtraHigh',
      'price_km_extra_high',
      'Price_km_extra_high',
    ),
    countKMExtraLow: pick<number>(source, 'countKMExtraLow', 'CountKMExtraLow'),
    countKMExtraHigh: pick<number>(source, 'countKMExtraHigh', 'CountKMExtraHigh'),
    allowToLow: pick<number>(source, 'allowToLow', 'AllowToLow'),
    allowToHigh: pick<number>(source, 'allowToHigh', 'AllowToHigh'),
  };
}
