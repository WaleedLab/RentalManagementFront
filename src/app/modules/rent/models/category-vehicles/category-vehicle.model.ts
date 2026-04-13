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
  /** Extra km price band (when defined on the category). */
  priceKmExtraLow?: number;
  priceKmExtraHigh?: number;
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
  id?: string;
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
