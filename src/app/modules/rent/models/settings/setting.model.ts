export interface Setting {
  id: number;
  number_hour_latefree: number;
  number_mints_late_forr_finshcontract: number;
  number_hour_late_forr_finshinday: number;
  number_incres_km_for_finshcontract: number;
  minValue: number;
  dateOfExp: boolean;
  dateOfExpWithNation: boolean;
  expDateAndInsuranceExp: boolean;
  oneBookingOrMore: boolean;
  bookingdebts: boolean;
  bookingissues: boolean;
  showBookingDistanceGps: boolean;
  tax: number;
  fleetId?: string;
  isUpdate?: boolean;
}

export interface SettingUpsertRequest {
  id?: number;
  number_hour_latefree: number;
  number_mints_late_forr_finshcontract: number;
  number_hour_late_forr_finshinday: number;
  number_incres_km_for_finshcontract: number;
  minValue: number;
  dateOfExp: boolean;
  dateOfExpWithNation: boolean;
  expDateAndInsuranceExp: boolean;
  oneBookingOrMore: boolean;
  bookingdebts: boolean;
  bookingissues: boolean;
  showBookingDistanceGps: boolean;
  tax: number;
  fleetId?: string;
}
