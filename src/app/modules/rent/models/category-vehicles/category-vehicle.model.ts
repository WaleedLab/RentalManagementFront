export interface CategoryVehicle {
  id: string;
  fleetId: string;
  nameAr: string;
  nameEn?: string;
  code?: string;
  description?: string;
  imageUrl?: string | null;
  isActive: boolean;
  price_day_low?: number;
  price_day_high?: number;
  price_month_low?: number;
  price_month_high?: number;
  priceHoureExtraLow?: number;
  priceHoureExtraHigh?: number;
  /** Extra km price band (when API sends dedicated fields). */
  priceKmExtraLow?: number;
  priceKmExtraHigh?: number;
  /**
   * Extra km **price** band — persisted name in API/forms is `CountKMExtra*`
   * (see category vehicle form: labels say price, controls use these keys).
   */
  countKMExtraLow?: number;
  countKMExtraHigh?: number;
  allowToLow?: number;
  allowToHigh?: number;
}

export interface CategoryVehicleFilters {
  fleetId?: string;
  search?: string;
  pageNumber: number;
  pageSize: number;
}

export interface CategoryVehicleUpsertRequest {
  id?: string | number;
  fleetId: string;
  nameAr: string;
  nameEn?: string;
  price_day_low: number;
  price_day_high: number;
  price_month_low: number;
  price_month_high: number;
  priceHoureExtraLow: number;
  priceHoureExtraHigh: number;
  countKMExtraLow: number;
  countKMExtraHigh: number;
  allowToLow: number;
  allowToHigh: number;
}
