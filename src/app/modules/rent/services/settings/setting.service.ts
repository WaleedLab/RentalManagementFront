import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import { normalizeSetting } from '../../models/settings/setting.normalizer';
import { Setting, SettingUpsertRequest } from '../../models/settings/setting.model';

@Injectable({
  providedIn: 'root',
})
export class SettingService {
  private api = inject(BaseService);
  private readonly base = 'Setting';

  getCurrent(fleetId?: string | null): Observable<Setting> {
    const query = buildFleetQueryParams(fleetId, 'both');
    return this.api.getData<unknown>(`${this.base}/List`, query).pipe(
      map(response => {
        const source = this.resolveSettingPayload(response, fleetId);
        if (!source) {
          return normalizeSetting({ fleetId: fleetId ?? undefined });
        }
        return normalizeSetting(source);
      }),
    );
  }

  save(payload: SettingUpsertRequest): Observable<Setting> {
    const body = this.toApiPayload(payload);
    const afterSave = (raw: unknown) =>
      normalizeSetting(this.resolveSettingPayload(raw, payload.fleetId) ?? {});

    if (payload.id && payload.id > 0) {
      return this.api.putData<unknown>(`${this.base}/${payload.id}`, body).pipe(map(afterSave));
    }
    return this.api.postData<unknown>(this.base, body).pipe(map(afterSave));
  }

  /**
   * Backend MediatR handlers return envelopes like `{ setting: SettingDto }`
   * (`GetSettingResponseDto`, `UpsertSettingResponseDto`). List endpoints may still
   * return a flat array or a single DTO — normalize all shapes before mapping.
   */
  private unwrapNestedSettingDto(raw: unknown): unknown {
    if (raw === null || raw === undefined) {
      return raw;
    }
    if (Array.isArray(raw)) {
      return raw;
    }
    if (typeof raw !== 'object') {
      return raw;
    }
    const o = raw as Record<string, unknown>;
    const nested = o['setting'] ?? o['Setting'];
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return nested;
    }
    return raw;
  }

  private pickSettingFromList(rows: unknown[], fleetId?: string | null): unknown {
    const wantedFleetId = normalizeFleetId(fleetId);
    const candidates = rows.map(row => this.unwrapNestedSettingDto(row));

    if (wantedFleetId && candidates.length > 0) {
      const match = candidates.find(row => {
        if (!row || typeof row !== 'object') {
          return false;
        }
        const r = row as Record<string, unknown>;
        const id = r['fleetId'] ?? r['FleetId'];
        const idStr = typeof id === 'string' ? id.trim().toLowerCase() : String(id ?? '').trim().toLowerCase();
        return idStr === wantedFleetId.toLowerCase();
      });
      if (match) {
        return match;
      }
    }
    return candidates[0];
  }

  private resolveSettingPayload(raw: unknown, fleetId?: string | null): unknown {
    const peeled = this.unwrapNestedSettingDto(raw);
    if (Array.isArray(peeled)) {
      return this.pickSettingFromList(peeled, fleetId);
    }
    return peeled;
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

