import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../shared/services/base/base.service';
import { buildFleetQueryParams } from '../../../shared/utils/fleet-query.utils';
import { MaintenanceBranchOption } from '../models/branch-reference.model';

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

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

@Injectable({ providedIn: 'root' })
export class MaintenanceBranchService {
  private readonly api = inject(BaseService);

  getList(fleetId?: string | null): Observable<MaintenanceBranchOption[]> {
    return this.api
      .getData<unknown[]>(
        'Branch/List',
        { ...buildFleetQueryParams(fleetId, 'both') },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => {
          const output: MaintenanceBranchOption[] = [];
          for (const raw of items ?? []) {
            const source = (raw ?? {}) as Record<string, unknown>;
            const id = toNumber(pickLoose(source, 'id', 'Id'));
            if (id === null || id <= 0) continue;
            output.push({
              id,
              nameAr: String(pickLoose(source, 'nameAr', 'NameAr') ?? '').trim() || undefined,
              nameEn: String(pickLoose(source, 'nameEn', 'NameEn') ?? '').trim() || undefined,
            });
          }
          return output;
        }),
      );
  }
}
