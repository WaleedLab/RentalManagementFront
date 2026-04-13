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

  getPaginated(params: CustomerFilters): Observable<PaginatedAggregatorResponse<Customer>> {
    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        ...buildFleetQueryParams(params.fleetId, 'both'),
        Search: params.search,
        search: params.search,
        isActive: params.isActive === '' ? undefined : params.isActive,
        PageNumber: params.pageNumber,
        PageSize: params.pageSize,
        pageNumber: params.pageNumber,
        pageSize: params.pageSize,
      })
      .pipe(map(response => normalizePaginatedResponse(response, normalizeCustomer)));
  }

  getById(id: string, fleetId?: string | null): Observable<Customer> {
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!normalizedFleetId) {
      return this.getByIdFromList(id);
    }

    return this.api
      .getData<unknown>(`${this.base}/${id}/${normalizedFleetId}`, undefined, {
        suppressErrorToast: true,
      })
      .pipe(
        map(normalizeCustomer),
        catchError(error => this.getByIdFromList(id, normalizedFleetId, error)),
      );
  }

  getByNationalId(nationalId: string, fleetId?: string | null): Observable<Customer | null> {
    const id = String(nationalId ?? '').trim();
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!id || !normalizedFleetId) {
      return throwError(() => new Error('Invalid nationalId or fleetId'));
    }

    const byPath = this.api
      .getData<unknown>(`${this.base}/GetCustomerByNationalId/${id}/${normalizedFleetId}`, undefined, {
        suppressErrorToast: true,
      })
      .pipe(map(normalizeCustomer));

    const byQuery = this.api
      .getData<unknown>(`${this.base}/GetCustomerByNationalId`, {
        NationalId: id,
        FleetId: normalizedFleetId,
      }, {
        suppressErrorToast: true,
      })
      .pipe(map(normalizeCustomer));

    return byPath.pipe(
      catchError(() => byQuery),
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

  private getByIdFromList(
    id: string,
    fleetId?: string,
    sourceError?: unknown,
  ): Observable<Customer> {
    return this.api
      .getData<unknown[]>(`${this.base}/List`, buildFleetQueryParams(fleetId, 'both'), {
        suppressErrorToast: true,
      })
      .pipe(
        map(items => (items ?? []).map(normalizeCustomer)),
        map(items => items.find(customer => String(customer.id) === String(id)) ?? null),
        map(customer => {
          if (!customer) {
            throw sourceError ?? new Error('Customer not found');
          }
          return customer;
        }),
        catchError(() => throwError(() => sourceError ?? new Error('Customer not found'))),
      );
  }
}
