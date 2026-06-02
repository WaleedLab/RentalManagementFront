import { Injectable, inject } from '@angular/core';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

import { BaseService } from '../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../shared/utils/fleet-query.utils';
import { MaintenanceVehicleOption } from '../models/vehicle-reference.model';

function pickLoose(source: Record<string, unknown> | undefined, ...candidates: string[]): unknown {
  if (!source || typeof source !== 'object') {
    return undefined;
  }
  const keyByLower = new Map<string, string>();
  for (const k of Object.keys(source)) {
    keyByLower.set(k.toLowerCase(), k);
  }
  for (const wanted of candidates) {
    const actual = keyByLower.get(wanted.toLowerCase());
    if (!actual) continue;
    const value = source[actual];
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function toOption(raw: unknown): MaintenanceVehicleOption | null {
  const source = (raw ?? {}) as Record<string, unknown>;
  const id = String(pickLoose(source, 'id', 'Id') ?? '').trim();
  if (!id) return null;
  return {
    id,
    plateNumber:
      String(pickLoose(source, 'plateNumber', 'PlateNumber', 'plantnumber', 'Plantnumber') ?? '').trim() ||
      undefined,
    serialNumber: String(pickLoose(source, 'serialNumber', 'SerialNumber') ?? '').trim() || undefined,
  };
}

/**
 * Vehicle dropdown source for the maintenance form.
 * Backed by `Vehicle/List` (GetVehiclesQuery: Fleetid / Branchid / Stutus).
 * Because `Vehicle/List` filters by a single status, an unfiltered call may
 * return nothing depending on the backend; in that case we merge per-status
 * lists so every vehicle shows up (mirrors the rent VehicleService fallback).
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceVehicleService {
  private readonly api = inject(BaseService);
  private static readonly STATUSES = ['IsAvalible', 'IsBooking', 'IsMaintanes', 'IsMangament', 'IsSold'];

  getList(params: { fleetId?: string | null; branchId?: number | null } = {}): Observable<MaintenanceVehicleOption[]> {
    return this.fetch(params).pipe(
      catchError(() => of([] as MaintenanceVehicleOption[])),
      switchMap(list => {
        if (list.length) {
          return of(list);
        }
        return forkJoin(
          MaintenanceVehicleService.STATUSES.map(status =>
            this.fetch(params, status).pipe(catchError(() => of([] as MaintenanceVehicleOption[]))),
          ),
        ).pipe(
          map(groups => {
            const byId = new Map<string, MaintenanceVehicleOption>();
            for (const group of groups) {
              for (const option of group) {
                byId.set(option.id, option);
              }
            }
            return Array.from(byId.values());
          }),
        );
      }),
    );
  }

  private fetch(
    params: { fleetId?: string | null; branchId?: number | null },
    status?: string,
  ): Observable<MaintenanceVehicleOption[]> {
    const fleetId = normalizeFleetId(params.fleetId);
    const branchId = params.branchId && params.branchId > 0 ? params.branchId : undefined;
    return this.api
      .getData<unknown[]>(
        'Vehicle/List',
        {
          ...buildFleetQueryParams(fleetId, 'both'),
          Fleetid: fleetId ?? undefined,
          Branchid: branchId,
          BranchId: branchId,
          ...(status ? { Stutus: status } : {}),
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => {
          const output: MaintenanceVehicleOption[] = [];
          for (const raw of items ?? []) {
            const option = toOption(raw);
            if (option) output.push(option);
          }
          return output;
        }),
      );
  }
}
