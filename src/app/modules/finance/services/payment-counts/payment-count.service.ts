import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { PaginatedAggregatorResponse } from '../../../../core/interfaces';

import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import {
  CreatePaymentCountRequest,
  PaymentCount,
  PaymentCountDetailLineRequest,
} from '../../models/payment-counts/payment-count.model';
import { normalizePaymentCount } from '../../models/payment-counts/payment-count.normalizer';

@Injectable({
  providedIn: 'root',
})
export class PaymentCountService {
  private api = inject(BaseService);
  private readonly base = 'Paymentcount';

  getList(fleetId?: string | null, branchId?: string | null): Observable<PaymentCount[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, {
      ...buildFleetQueryParams(fleetId, 'both'),
      BranchId: branchId ?? undefined,
    }).pipe(
      map(items => (items ?? []).map(normalizePaymentCount)),
    );
  }

  getPaginated(params: {
    fleetId?: string | null;
    branchId?: number | null;
    status?: number | null;
    bondTypePaymentcount?: number | null;
    paymentTypePaymentcount?: number | null;
    pageSize?: number;
    pageNumber?: number;
    search?: string;
    orderByDirection?: 'ASC' | 'DESC';
    orderBy?: 'CreatedAt' | 'Paid' | 'UpdatedAt';
  }): Observable<PaginatedAggregatorResponse<PaymentCount>> {
    const fleetId = params.fleetId?.trim();
    const normalizedDirection = params.orderByDirection?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return this.api
      .getData<unknown>(`${this.base}/Paginated`, {
        FleetId: fleetId || undefined,
        IdFleet: fleetId || undefined,
        BRANCHID: params.branchId ?? undefined,
        BranchId: params.branchId ?? undefined,
        Status: params.status ?? undefined,
        status: params.status ?? undefined,
        BondTypePaymentcount: params.bondTypePaymentcount ?? undefined,
        bondTypePaymentcount: params.bondTypePaymentcount ?? undefined,
        BondType: params.bondTypePaymentcount ?? undefined,
        bondType: params.bondTypePaymentcount ?? undefined,
        PaymentTypePaymentcount: params.paymentTypePaymentcount ?? undefined,
        paymentTypePaymentcount: params.paymentTypePaymentcount ?? undefined,
        PaymentType: params.paymentTypePaymentcount ?? undefined,
        paymentType: params.paymentTypePaymentcount ?? undefined,
        PageSize: params.pageSize,
        PageNumber: params.pageNumber,
        Search: params.search?.trim() || undefined,
        OrderByDirection: params.orderByDirection ? normalizedDirection : undefined,
        OrderBy: params.orderBy,
        pageSize: params.pageSize,
        pageNumber: params.pageNumber,
        fleetId: fleetId || undefined,
        branchId: params.branchId ?? undefined,
        statusId: params.status ?? undefined,
        bondTypeId: params.bondTypePaymentcount ?? undefined,
        paymentTypeId: params.paymentTypePaymentcount ?? undefined,
        search: params.search?.trim() || undefined,
        orderByDirection: params.orderByDirection ? normalizedDirection.toLowerCase() : undefined,
        orderBy: params.orderBy,
      })
      .pipe(map(response => normalizePaginatedResponse(response, normalizePaymentCount)));
  }

  getById(id: string, fleetId: string): Observable<PaymentCount> {
    const encodedId = encodeURIComponent(id);
    const encodedFleetId = encodeURIComponent(fleetId);
    return this.api
      .getData<unknown>(`${this.base}/${encodedId}/${encodedFleetId}`)
      .pipe(map(item => normalizePaymentCount(item)));
  }

  /**
   * Maps `PaymentcountRouting.GetByIdBooking`: `GET Paymentcount/{IdBooking}/{fleetid}`.
   * (`CarRentalManagament.Api.Common.Routering.PaymentcountRouting`)
   */
  getByBookingId(idBooking: number, fleetId?: string | null): Observable<PaymentCount[]> {
    const fleet = normalizeFleetId(fleetId);
    if (!fleet || !Number.isFinite(idBooking) || idBooking <= 0) {
      return of([]);
    }
    const idSeg = encodeURIComponent(String(idBooking));
    const fleetSeg = encodeURIComponent(fleet);
    return this.api
      .getData<unknown[]>(`${this.base}/${idSeg}/${fleetSeg}`, undefined, { suppressErrorToast: true })
      .pipe(map(items => (Array.isArray(items) ? items : []).map(normalizePaymentCount)));
  }

  /**
   * Maps `PaymentcountRouting.GetSumByIdBooking`: `GET Paymentcount/sum/{IdBooking}/{fleetid}`.
   */
  getSumForBooking(idBooking: number, fleetId?: string | null): Observable<number | null> {
    const fleet = normalizeFleetId(fleetId);
    if (!fleet || !Number.isFinite(idBooking) || idBooking <= 0) {
      return of(null);
    }
    const idSeg = encodeURIComponent(String(idBooking));
    const fleetSeg = encodeURIComponent(fleet);
    return this.api
      .getData<unknown>(`${this.base}/sum/${idSeg}/${fleetSeg}`, undefined, { suppressErrorToast: true })
      .pipe(
        map(raw => {
          if (typeof raw === 'number' && Number.isFinite(raw)) {
            return raw;
          }
          const source = (raw ?? {}) as Record<string, unknown>;
          const candidate =
            source['sumPaymentBooking'] ??
            source['SumPaymentBooking'] ??
            source['sum'] ??
            source['Sum'];
          const n = Number(candidate);
          return Number.isFinite(n) ? n : null;
        }),
      );
  }

  /**
   * Maps `PaymentcountRouting.GetLastByIdBooking`: `GET Paymentcount/last/{IdBooking}/{fleetid}`.
   */
  getLastForBooking(idBooking: number, fleetId?: string | null): Observable<PaymentCount | null> {
    const fleet = normalizeFleetId(fleetId);
    if (!fleet || !Number.isFinite(idBooking) || idBooking <= 0) {
      return of(null);
    }
    const idSeg = encodeURIComponent(String(idBooking));
    const fleetSeg = encodeURIComponent(fleet);
    return this.api
      .getData<unknown>(`${this.base}/last/${idSeg}/${fleetSeg}`, undefined, { suppressErrorToast: true })
      .pipe(map(raw => (raw ? normalizePaymentCount(raw) : null)));
  }

  create(payload: CreatePaymentCountRequest): Observable<unknown> {
    return this.api.postData<unknown>(this.base, this.toCreateApiPayload(payload));
  }

  private toCreateApiPayload(payload: CreatePaymentCountRequest): Record<string, unknown> {
    const mappedDetails = payload.details?.map((line, index) => this.toCreateDetailPayload(line, index));
    return {
      idCustomer: payload.idCustomer,
      IdCustomer: payload.idCustomer,
      paid: payload.paid,
      Paid: payload.paid,
      dscription: payload.dscription,
      Dscription: payload.dscription,
      description: payload.dscription,
      Description: payload.dscription,
      idVehicle: payload.idVehicle,
      IdVehicle: payload.idVehicle,
      idBranch: payload.idBranch,
      IdBranch: payload.idBranch,
      paymentType: payload.paymentType,
      PaymentType: payload.paymentType,
      bondType: payload.bondType,
      BondType: payload.bondType,
      status: payload.status,
      Status: payload.status,
      idCash: payload.idCash,
      IdCash: payload.idCash,
      idBank: payload.idBank,
      IdBank: payload.idBank,
      paidCash: payload.paidCash,
      PaidCash: payload.paidCash,
      paidBank: payload.paidBank,
      PaidBank: payload.paidBank,
      expenseCategory: payload.expenseCategory,
      ExpenseCategory: payload.expenseCategory,
      idBooking: payload.idBooking,
      IdBooking: payload.idBooking,
      stutusbooking: payload.stutusbooking,
      Stutusbooking: payload.stutusbooking,
      statusBooking: payload.stutusbooking,
      StatusBooking: payload.stutusbooking,
      idFinancialYear: payload.idFinancialYear,
      IdFinancialYear: payload.idFinancialYear,
      fleetId: payload.fleetId,
      FleetId: payload.fleetId,
      details: mappedDetails,
      Details: mappedDetails,
      paymentCountDetails: mappedDetails,
      PaymentCountDetails: mappedDetails,
      detailLines: mappedDetails,
      DetailLines: mappedDetails,
    };
  }

  private toCreateDetailPayload(
    line: PaymentCountDetailLineRequest,
    index: number,
  ): Record<string, unknown> {
    const idCounting = String(line.idCounting ?? '').trim();
    const price = Number(line.price ?? 0);
    return {
      idCounting,
      IdCounting: idCounting,
      countingId: idCounting,
      CountingId: idCounting,
      price,
      Price: price,
      node: line.node,
      Node: line.node,
      idBranch: line.idBranch,
      IdBranch: line.idBranch,
      idFinancialYear: line.idFinancialYear,
      IdFinancialYear: line.idFinancialYear,
      lineOrder: index + 1,
      LineOrder: index + 1,
    };
  }
}

