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
    price_day_low: pick<number>(
      source,
      'price_day_low',
      'Price_day_low',
      'priceDayLow',
      'PriceDayLow',
      'Price_dayLow',
    ),
    price_day_high: pick<number>(
      source,
      'price_day_high',
      'Price_day_high',
      'priceDayHigh',
      'PriceDayHigh',
      'Price_dayHigh',
    ),
    price_month_low: pick<number>(source, 'price_month_low', 'Price_month_low', 'priceMonthLow', 'PriceMonthLow'),
    price_month_high: pick<number>(
      source,
      'price_month_high',
      'Price_month_high',
      'priceMonthHigh',
      'PriceMonthHigh',
    ),
    priceHoureExtraLow: pick<number>(
      source,
      'priceHoureExtraLow',
      'PriceHoureExtraLow',
      'price_houre_extra_low',
      'Price_houre_extra_low',
      'priceHourExtraLow',
      'PriceHourExtraLow',
    ),
    priceHoureExtraHigh: pick<number>(
      source,
      'priceHoureExtraHigh',
      'PriceHoureExtraHigh',
      'price_houre_extra_high',
      'Price_houre_extra_high',
      'priceHourExtraHigh',
      'PriceHourExtraHigh',
    ),
    /**
     * Backend / legacy payloads often expose extra-km **price** as `CountKMExtraLow`/`High`
     * (see category form: labels say price but controls bind to countKM*). Prefer explicit
     * `priceKmExtra*` when present, otherwise fall back to count fields.
     */
    priceKmExtraLow: pick<number>(
      source,
      'priceKmExtraLow',
      'PriceKmExtraLow',
      'price_km_extra_low',
      'Price_km_extra_low',
      'priceKm_extra_low',
      'PriceKm_extra_low',
      'kmExtraPriceLow',
      'KmExtraPriceLow',
    ) ?? pick<number>(source, 'countKMExtraLow', 'CountKMExtraLow', 'count_km_extra_low', 'Count_km_extra_low'),
    priceKmExtraHigh: pick<number>(
      source,
      'priceKmExtraHigh',
      'PriceKmExtraHigh',
      'price_km_extra_high',
      'Price_km_extra_high',
      'priceKm_extra_high',
      'PriceKm_extra_high',
      'kmExtraPriceHigh',
      'KmExtraPriceHigh',
    ) ?? pick<number>(source, 'countKMExtraHigh', 'CountKMExtraHigh', 'count_km_extra_high', 'Count_km_extra_high'),
    countKMExtraLow: pick<number>(
      source,
      'countKMExtraLow',
      'CountKMExtraLow',
      'count_km_extra_low',
      'Count_km_extra_low',
    ),
    countKMExtraHigh: pick<number>(
      source,
      'countKMExtraHigh',
      'CountKMExtraHigh',
      'count_km_extra_high',
      'Count_km_extra_high',
    ),
    allowToLow: pick<number>(source, 'allowToLow', 'AllowToLow'),
    allowToHigh: pick<number>(source, 'allowToHigh', 'AllowToHigh'),
  };
}
