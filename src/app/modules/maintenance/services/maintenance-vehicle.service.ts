import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../shared/services/base/base.service';
import { buildFleetQueryParams } from '../../../shared/utils/fleet-query.utils';
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

@Injectable({ providedIn: 'root' })
export class MaintenanceVehicleService {
  private readonly api = inject(BaseService);

  getList(params: { fleetId?: string | null; branchId?: number | null } = {}): Observable<MaintenanceVehicleOption[]> {
    return this.api
      .getData<unknown[]>(
        'Vehicle/List',
        {
          ...buildFleetQueryParams(params.fleetId, 'both'),
          BranchId: params.branchId && params.branchId > 0 ? params.branchId : undefined,
          branchId: params.branchId && params.branchId > 0 ? params.branchId : undefined,
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => {
          const output: MaintenanceVehicleOption[] = [];
          for (const raw of items ?? []) {
            const source = (raw ?? {}) as Record<string, unknown>;
            const id = String(pickLoose(source, 'id', 'Id') ?? '').trim();
            if (!id) continue;
            output.push({
              id,
              plateNumber:
                String(pickLoose(source, 'plateNumber', 'PlateNumber', 'plantnumber', 'Plantnumber') ?? '').trim() ||
                undefined,
              serialNumber: String(pickLoose(source, 'serialNumber', 'SerialNumber') ?? '').trim() || undefined,
            });
          }
          return output;
        }),
      );
  }
}
