import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { normalizeSetting } from '../../models/settings/setting.normalizer';
import { Setting, SettingUpsertRequest } from '../../models/settings/setting.model';

@Injectable({
  providedIn: 'root',
})
export class SettingService {
  private api = inject(BaseService);
  private readonly base = 'Setting';

  getCurrent(fleetId?: string | null): Observable<Setting> {
    return this.api
      .getData<unknown>(`${this.base}/List`, {
        fleetId: fleetId ?? undefined,
      })
      .pipe(
        map(response => {
          const source = Array.isArray(response) ? response[0] : response;
          if (!source) {
            return normalizeSetting({ fleetId: fleetId ?? undefined });
          }
          return normalizeSetting(source);
        }),
      );
  }

  save(payload: SettingUpsertRequest): Observable<Setting> {
    const body = this.toApiPayload(payload);
    if (payload.id && payload.id > 0) {
      return this.api.putData<unknown>(`${this.base}/${payload.id}`, body).pipe(map(normalizeSetting));
    }
    return this.api.postData<unknown>(this.base, body).pipe(map(normalizeSetting));
  }

  private toApiPayload(payload: SettingUpsertRequest): Record<string, unknown> {
    return {
      id: payload.id && payload.id > 0 ? payload.id : undefined,
      number_hour_latefree: payload.number_hour_latefree,
      number_mints_late_forr_finshcontract: payload.number_mints_late_forr_finshcontract,
      number_hour_late_forr_finshinday: payload.number_hour_late_forr_finshinday,
      number_incres_km_for_finshcontract: payload.number_incres_km_for_finshcontract,
      minValue: payload.minValue,
      dateOfExp: payload.dateOfExp,
      dateOfExpWithNation: payload.dateOfExpWithNation,
      expDateAndInsuranceExp: payload.expDateAndInsuranceExp,
      oneBookingOrMore: payload.oneBookingOrMore,
      bookingdebts: payload.bookingdebts,
      bookingissues: payload.bookingissues,
      showBookingDistanceGps: payload.showBookingDistanceGps,
      tax: payload.tax,
      fleetId: payload.fleetId,
    };
  }
}

