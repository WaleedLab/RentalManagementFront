import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseService } from '../../../../shared/services/base/base.service';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { PendingAccountingEntry } from '../../models/pending-accounting-entries/pending-accounting-entry.model';
import { normalizePendingAccountingEntry } from '../../models/pending-accounting-entries/pending-accounting-entry.normalizer';

export interface PendingAccountingEntryPaginatedRequest {
  fleetId: string;
  branchId?: number;
  isPosted?: boolean;
  pageNumber?: number;
  pageSize?: number;
}

@Injectable({ providedIn: 'root' })
export class PendingAccountingEntryService {
  private api = inject(BaseService);
  private readonly resource = 'PendingAccountingEntry';

  getPaginated(
    request: PendingAccountingEntryPaginatedRequest,
  ): Observable<PaginatedAggregatorResponse<PendingAccountingEntry>> {
    const params: Record<string, string | number | boolean | undefined> = {
      FleetId: request.fleetId,
      PageNumber: request.pageNumber ?? 1,
      PageSize: request.pageSize ?? 20,
    };

    if (request.branchId != null && request.branchId > 0) {
      params['BranchId'] = request.branchId;
      params['BRANCHID'] = request.branchId;
    }
    if (request.isPosted != null) {
      params['IsPosted'] = request.isPosted;
    }

    return this.api
      .getData<unknown>(`${this.resource}/Paginated`, params, { suppressErrorToast: true })
      .pipe(map(response => normalizePaginatedResponse(response, normalizePendingAccountingEntry)));
  }
}
