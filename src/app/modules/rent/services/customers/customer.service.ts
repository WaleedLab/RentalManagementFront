import { Injectable, inject } from '@angular/core';

import { Observable, catchError, from, map, of, switchMap, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseService } from '../../../../shared/services/base/base.service';
import {
  buildFleetQueryParams,
  normalizeFleetId,
} from '../../../../shared/utils/fleet-query.utils';
import { buildImageUploadPayload } from '../../../../shared/utils/image-upload.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { Customer, CustomerFilters, CustomerUpsertRequest } from '../../models';
import { normalizeCustomer } from '../../models/customers/customer.normalizer';

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private api = inject(BaseService);
  private readonly base = 'Customer';

  getList(params: { fleetId?: string | null; isActive?: boolean | '' } = {}): Observable<Customer[]> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(params.fleetId, 'both'),
          isActive: params.isActive === '' ? undefined : params.isActive,
        },
        { suppressErrorToast: true },
      )
      .pipe(map(items => (items ?? []).map(normalizeCustomer)));
  }

  getPaginated(params: CustomerFilters): Observable<PaginatedAggregatorResponse<Customer>> {
    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        ...buildFleetQueryParams(params.fleetId, 'both'),
        Search: params.search,
        search: params.search,
        SearchField: params.searchField,
        searchField: params.searchField,
        isActive: params.isActive === '' ? undefined : params.isActive,
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
        OrderByDirection: params.orderByDirection ?? 'DESC',
        orderByDirection: params.orderByDirection ?? 'DESC',
        OrderBy: params.orderBy ?? 'CreatedAt',
        orderBy: params.orderBy ?? 'CreatedAt',
      })
      .pipe(map(response => normalizePaginatedResponse(response, normalizeCustomer)));
  }

  getById(id: string, fleetId?: string | null): Observable<Customer> {
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!normalizedFleetId) {
      return throwError(() => new Error('FleetId is required to load customer details'));
    }

    const rawId = String(id);
    const encodedId = encodeURIComponent(rawId);
    const rawFleetId = normalizedFleetId;
    const encodedFleetId = encodeURIComponent(rawFleetId);
    return this.api
      .getData<unknown>(`${this.base}/${encodedId}/${encodedFleetId}`, undefined, {
        suppressErrorToast: true,
      })
      .pipe(
        map(raw => normalizeCustomer(this.unwrapResultPayload(raw))),
        catchError(() =>
          this.api.getData<unknown>(
            `${this.base}/${encodedId}`,
            {
              fleetid: rawFleetId,
              FleetId: rawFleetId,
            },
            { suppressErrorToast: true },
          ),
        ),
        map(raw => normalizeCustomer(this.unwrapResultPayload(raw))),
        catchError(() => throwError(() => new Error('Failed to load customer details from backend'))),
      );
  }

  private unwrapResultPayload(raw: unknown): unknown {
    const source = (raw ?? {}) as Record<string, unknown>;
    if (!source || typeof source !== 'object') {
      return raw;
    }
    return (
      source['data'] ??
      source['Data'] ??
      source['value'] ??
      source['Value'] ??
      source['result'] ??
      source['Result'] ??
      raw
    );
  }

  getByNationalId(nationalId: string, fleetId?: string | null): Observable<Customer | null> {
    const id = String(nationalId ?? '').trim();
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!id || !normalizedFleetId) {
      return throwError(() => new Error('Invalid nationalId or fleetId'));
    }

    const byPath = this.api
      .getData<unknown>(`${this.base}/ByNationalId/${id}/${normalizedFleetId}`, undefined, {
        suppressErrorToast: true,
      })
      .pipe(map(raw => this.normalizeCustomerLookupResponse(raw)));

    const byQuery = this.api
      .getData<unknown>(`${this.base}/ByNationalId`, {
        NationalId: id,
        FleetId: normalizedFleetId,
        fleetid: normalizedFleetId,
      }, {
        suppressErrorToast: true,
      })
      .pipe(map(raw => this.normalizeCustomerLookupResponse(raw)));

    return byPath.pipe(
      catchError(() => byQuery),
      catchError(() => this.getByNationalIdFromList(id, normalizedFleetId)),
      catchError(() => of(null)),
    );
  }

  create(body: CustomerUpsertRequest): Observable<unknown> {
    return from(this.toApiPayload(body)).pipe(
      switchMap(payload => this.api.postData(this.base, payload)),
    );
  }

  update(body: CustomerUpsertRequest): Observable<unknown> {
    return from(this.toApiPayload(body)).pipe(
      switchMap(payload => this.api.putData(`${this.base}/${body.id}`, payload)),
    );
  }

  softDelete(id: string): Observable<unknown> {
    return this.api.patchData(`${this.base}/SoftDelete/${id}`, {});
  }

  private async toApiPayload(body: CustomerUpsertRequest): Promise<Record<string, unknown>> {
    const imagePayload = await buildImageUploadPayload(body.image);

    return {
      id: body.id,
      nameAr: body.nameAr,
      nameEn: body.nameEn,
      firstMobileNumber: body.firstMobileNumber,
      secondMobileNumber: body.secondMobileNumber,
      thirdMobileNumber: body.thirdMobileNumber,
      address: body.address,
      licenceNo: body.licenceNo,
      idNationality: body.idNationality,
      dateIdNationality: body.dateIdNationality,
      birthDay: body.birthDay,
      plaseIdNationality: body.plaseIdNationality,
      plaseDrivinglicense: body.plaseDrivinglicense,
      nationality: body.nationality,
      dateDrivinglicense: body.dateDrivinglicense,
      dateDrivinglicenseHajri: body.dateDrivinglicenseHajri,
      taxRecord: body.taxRecord,
      email: body.email,
      idSubscriptionsOfCustomer: body.idSubscriptionsOfCustomer,
      fleetId: body.fleetId,
      notes: body.notes,
      isActive: body.isActive,
      url: imagePayload?.attachment,
      Url: imagePayload?.attachment,
      imageExtension: imagePayload?.extension,
      ImageExtension: imagePayload?.extension,
      attachment: imagePayload?.attachment,
      Attachment: imagePayload?.attachment,
      extension: imagePayload?.extension,
      Extension: imagePayload?.extension,
    };
  }

  private getByNationalIdFromList(nationalId: string, fleetId?: string): Observable<Customer | null> {
    const normalizedNationalId = String(nationalId ?? '').trim();
    if (!normalizedNationalId) {
      return of(null);
    }

    return this.api
      .getData<unknown[]>(`${this.base}/List`, buildFleetQueryParams(fleetId, 'both'), {
        suppressErrorToast: true,
      })
      .pipe(
        map(items => (items ?? []).map(normalizeCustomer)),
        map(items =>
          items.find(customer => {
            const candidate = String(customer.idNationality ?? customer.identityNumber ?? '').trim();
            return candidate === normalizedNationalId;
          }) ?? null,
        ),
      );
  }

  /**
   * Backend lookup may return full customer object OR only customer id.
   * Keep both shapes valid so booking flow can always continue to getById.
   */
  private normalizeCustomerLookupResponse(raw: unknown): Customer | null {
    if (raw === null || raw === undefined) {
      return null;
    }

    if (typeof raw === 'number' || typeof raw === 'string') {
      const id = String(raw).trim();
      if (!id) {
        return null;
      }
      return {
        id,
        fullName: '',
        isActive: true,
      };
    }

    return normalizeCustomer(raw);
  }
}
