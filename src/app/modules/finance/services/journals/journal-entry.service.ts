import { Injectable, inject } from '@angular/core';

import { map, Observable } from 'rxjs';
import { PaginatedAggregatorResponse } from '../../../../core/interfaces';

import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams } from '../../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import {
  CreateJournalEntryRequest,
  JournalEntry,
  JournalEntryPaginatedRequest,
} from '../../models/journals/journal-entry.model';
import { normalizeJournalEntry } from '../../models/journals/journal-entry.normalizer';

@Injectable({
  providedIn: 'root',
})
export class JournalEntryService {
  private api = inject(BaseService);
  private readonly base = 'Journal';

  getList(fleetId?: string | null): Observable<JournalEntry[]> {
    return this.api
      .getData<unknown[]>(`${this.base}/List`, {
        ...buildFleetQueryParams(fleetId, 'both'),
      })
      .pipe(map(items => (items ?? []).map(normalizeJournalEntry)));
  }

  getPaginated(params: JournalEntryPaginatedRequest): Observable<PaginatedAggregatorResponse<JournalEntry>> {
    const normalizedDirection = params.orderByDirection?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        PageSize: params.pageSize,
        PageNumber: params.pageNumber,
        FleetId: params.fleetId ?? undefined,
        BRANCHID: params.branchId ?? undefined,
        Status: params.status ?? undefined,
        JournalType: params.journalType ?? undefined,
        OperationType: params.operationType ?? undefined,
        Search: params.search?.trim() || undefined,
        DateFrom: params.dateFrom || undefined,
        DateTo: params.dateTo || undefined,
        OrderByDirection: params.orderByDirection ? normalizedDirection : undefined,
        OrderBy: params.orderBy ?? undefined,
        pageSize: params.pageSize,
        pageNumber: params.pageNumber,
        fleetId: params.fleetId ?? undefined,
        branchId: params.branchId ?? undefined,
        status: params.status ?? undefined,
        journalType: params.journalType ?? undefined,
        operationType: params.operationType ?? undefined,
        search: params.search?.trim() || undefined,
        dateFrom: params.dateFrom || undefined,
        dateTo: params.dateTo || undefined,
        orderByDirection: params.orderByDirection ? normalizedDirection.toLowerCase() : undefined,
        orderBy: params.orderBy ?? undefined,
      })
      .pipe(map(response => normalizePaginatedResponse(response, normalizeJournalEntry)));
  }

  create(payload: CreateJournalEntryRequest): Observable<unknown> {
    return this.api.postData<unknown>(this.base, {
      date: payload.date,
      node: payload.node,
      journalType: payload.journalType,
      debtir: payload.debtir,
      credit: payload.credit,
      balannce: payload.balannce,
      operationType: payload.operationType,
      status: payload.status,
      isSystemOperation: payload.isSystemOperation ?? false,
      idFinancialYear: payload.idFinancialYear,
      idBranch: payload.idBranch,
      fleetId: payload.fleetId,
      details: payload.details.map(line => ({
        idCounting: line.idCounting,
        debtir: line.debtir,
        credit: line.credit,
        balannce: line.balannce,
        node: line.node,
        status: line.status ?? null,
        idVehicle: line.idVehicle ?? null,
        customerId: line.customerId ?? null,
      })),
    });
  }
}
