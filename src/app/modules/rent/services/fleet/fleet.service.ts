import { Injectable, inject } from '@angular/core';
import { Observable, from, map, switchMap } from 'rxjs';

import type { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions } from '../../../../shared/services/base/base.service';
import { BaseService } from '../../../../shared/services/base/base.service';
import { buildImageUploadPayload } from '../../../../shared/utils/image-upload.utils';
import type { Fleet, FleetUpsertRequest, PaginatedRequest } from '../../models';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizeFleet } from '../../models/fleet/fleet.normalizer';

@Injectable({
  providedIn: 'root',
})
export class FleetService {
  private api = inject(BaseService);

  private readonly base = 'Fleet';

  getList(options?: BaseRequestOptions): Observable<Fleet[]> {
    return this.api
      .getData<unknown[]>(`${this.base}/List`, undefined, {
        suppressErrorToast: true,
        ...options,
      })
      .pipe(map(items => (items ?? []).map(normalizeFleet)));
  }

  getPaginated(params: PaginatedRequest, options?: BaseRequestOptions): Observable<PaginatedAggregatorResponse<Fleet>> {
    return this.api.getData<unknown>(`${this.base}/Paginated`, {
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      Search: params.search,
      pageNumber: params.pageNumber,
      pageSize: params.pageSize,
      search: params.search,
    }, options).pipe(map(response => normalizePaginatedResponse(response, normalizeFleet)));
  }

  getById(id: string): Observable<Fleet> {
    return this.api.getData<unknown>(`${this.base}/${id}`).pipe(map(normalizeFleet));
  }

  create(body: FleetUpsertRequest): Observable<Fleet> {
    return from(this.toApiPayload(body, undefined)).pipe(
      switchMap(payload => this.api.postData<Fleet>(this.base, payload)),
    );
  }

  update(body: FleetUpsertRequest & { id: string }): Observable<Fleet> {
    return from(this.toApiPayload(body, body.id)).pipe(
      switchMap(payload => this.api.putData<Fleet>(`${this.base}/${body.id}`, payload)),
    );
  }

  private async toApiPayload(
    body: FleetUpsertRequest,
    id?: string,
  ): Promise<Record<string, unknown>> {
    const imagePayload = await buildImageUploadPayload(body.image);

    const payload: Record<string, unknown> = {
      Name: body.name,
      Description: body.description ?? null,
      FleetCode: body.fleetCode ?? null,
      TaxNumber: body.taxNumber ?? '',
      Location: body.location ?? null,
      ContactNumber: body.contactNumber ?? null,
      Email: body.email ?? null,
    };

    if (id) {
      payload['Id'] = id;
      payload['id'] = id;
    }

    // Only send base64 when user picked a new file — backend keeps old Url when these are empty.
    if (imagePayload) {
      payload['Url'] = imagePayload.attachment;
      payload['ImageExtension'] = imagePayload.extension;
    }

    return payload;
  }
}




