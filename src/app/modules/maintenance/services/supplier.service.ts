import { Injectable, inject } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../core/interfaces';
import { BaseService } from '../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../shared/utils/paginated-response.normalizer';
import { Supplier, SupplierFilters, SupplierUpsertRequest } from '../models/supplier.model';
import { normalizeSupplier } from '../models/supplier.normalizer';

@Injectable({ providedIn: 'root' })
export class SupplierService {
  private api = inject(BaseService);
  /** Matches `SupplieresRouting.Prefix` (not legacy `SupplierRouting`). */
  private readonly base = 'Supplieres';

  getPaginated(params: SupplierFilters): Observable<PaginatedAggregatorResponse<Supplier>> {
    const orderBy = params.orderBy ?? 0;
    const direction = params.orderByDirection ?? 'DESC';
    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        ...buildFleetQueryParams(params.fleetId, 'both'),
        Fleetid: normalizeFleetId(params.fleetId) ?? undefined,
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        Search: params.search,
        search: params.search,
        OrderBy: orderBy,
        orderBy: orderBy,
        OrderByDirection: direction,
        orderByDirection: direction,
      })
      .pipe(map(response => normalizePaginatedResponse(response, normalizeSupplier)));
  }

  getList(fleetId?: string | null): Observable<Supplier[]> {
    return this.api
      .getData<unknown[]>(`${this.base}/List`, {
        ...buildFleetQueryParams(fleetId, 'both'),
      })
      .pipe(
        map(items =>
          (items ?? [])
            .map(item => normalizeSupplier(item))
            .filter(supplier => Number(supplier.id) > 0),
        ),
      );
  }

  getById(id: string, fleetId?: string | null): Observable<Supplier> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    return this.api
      .getData<unknown>(`${this.base}/${encodeURIComponent(id)}/${encodeURIComponent(fid)}`)
      .pipe(map(raw => normalizeSupplier(raw)));
  }

  create(body: SupplierUpsertRequest): Observable<unknown> {
    return this.api.postData(this.base, this.toPayload(body));
  }

  update(body: SupplierUpsertRequest): Observable<unknown> {
    if (!body.id) {
      return throwError(() => new Error('Id is required for update'));
    }
    return this.api.putData(`${this.base}/${encodeURIComponent(body.id)}`, this.toPayload(body));
  }

  softDelete(id: string | number, fleetId: string): Observable<unknown> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    return this.api.patchData(`${this.base}/SoftDelete/${encodeURIComponent(String(id))}`, {
      FleetId: fid,
      fleetId: fid,
      Idfleet: fid,
    });
  }

  private toPayload(body: SupplierUpsertRequest): Record<string, unknown> {
    const idNum = body.id ? Number(body.id) : undefined;
    return {
      Id: idNum,
      id: idNum,
      FleetId: body.fleetId,
      fleetId: body.fleetId,
      SupplierName: body.supplierName,
      supplierName: body.supplierName,
      Phone: body.phone,
      phone: body.phone,
      Phone2: body.phone2 ?? null,
      phone2: body.phone2 ?? null,
      Address: body.address ?? null,
      address: body.address ?? null,
      Email: body.email ?? null,
      email: body.email ?? null,
      TaxRecord: body.taxRecord ?? null,
      taxRecord: body.taxRecord ?? null,
      AccountNumber: body.accountNumber ?? null,
      accountNumber: body.accountNumber ?? null,
    };
  }
}
