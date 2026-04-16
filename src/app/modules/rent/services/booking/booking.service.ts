import { Injectable, inject } from '@angular/core';

import { Observable, catchError, map, of, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { Booking, BookingCreateRequest, BookingFilters, BookingUpdateRequest } from '../../models';
import { normalizeBooking } from '../../models/booking/booking.normalizer';

@Injectable({
  providedIn: 'root',
})
export class BookingService {
  private api = inject(BaseService);
  private readonly base = 'Booking';

  getList(params: { fleetId?: string | null; branchId?: number | null } = {}): Observable<Booking[]> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(params.fleetId, 'id'),
          BranchId: params.branchId ?? undefined,
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => (items ?? []).map(normalizeBooking)),
        catchError(() => of([])),
      );
  }

  getPaginated(params: BookingFilters): Observable<PaginatedAggregatorResponse<Booking>> {
    return this.api
      .getData<unknown>(
        `${this.base}/Paginated`,
        {
          PageNumber: params.pageNumber,
          PageSize: params.pageSize,
          ...buildFleetQueryParams(params.fleetId, 'fleet'),
          BRANCHID: params.branchId ?? undefined,
          Search: params.search,
          OrderByDirection: params.orderByDirection ?? 'DESC',
          OrderBy: params.orderBy ?? 'CreatedAt',
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(response => normalizePaginatedResponse(response, normalizeBooking)),
        catchError(() => this.getPaginatedFromListFallback(params)),
      );
  }

  getById(id: string, fleetId?: string | null): Observable<Booking> {
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!normalizedFleetId) {
      return this.getByIdFromList(id);
    }

    return this.api.getData<unknown>(`${this.base}/${id}/${normalizedFleetId}`).pipe(
      map(normalizeBooking),
      catchError(error => this.getByIdFromList(id, normalizedFleetId, error)),
    );
  }

  create(body: BookingCreateRequest): Observable<unknown> {
    return this.api.postData(this.base, this.toCreateBookingPayload(body));
  }

  /**
   * Backend model binder in this solution often expects PascalCase alongside camelCase
   * (see `PaymentCountService` / `VehicleService`). Duplicate critical fields here to avoid 400.
   */
  private toCreateBookingPayload(body: BookingCreateRequest): Record<string, unknown> {
    return {
      ...body,
      NameAr: body.nameAr,
      FirstMobileNumber: body.firstMobileNumber,
      Address: body.address,
      IdNationality: body.idNationality,
      DateDrivinglicense: body.dateDrivinglicense,
      DateDrivingLicense: body.dateDrivinglicense,
      Nationality: body.nationality,
      IdVehicle: body.idVehicle,
      CheckoutCounter: body.checkoutCounter,
      Total: body.total,
      TOTAL: body.total,
      StartDate: body.startDate,
      EndDate: body.endDate,
      CountOfDay: body.countOfDay,
      DateReturnVehical: body.dateReturnVehical,
      PriceInDay: body.priceInDay,
      AllowTo: body.allowTo,
      CountKMExtra: body.countKMExtra,
      PriceHoureExtra: body.priceHoureExtra,
      Paid: body.paid,
      Note: body.note,
      PlaceUSE: body.placeUSE,
      IdBank: body.idBank,
      IdCash: body.idCash,
      PaidCash: body.paidCash,
      PaidBank: body.paidBank,
      PaymentType: body.paymentType,
      IdCountingCustVehicle: body.idCountingCustVehicle ?? body.idCountingCust,
      idCountingCustVehicle: body.idCountingCustVehicle ?? body.idCountingCust,
      BirthDay: body.birthDay,
      NumberBookingINBasame: body.numberBookingINBasame,
      FleetId: body.fleetId,
      IdBranch: body.idBranch,
      BranchId: body.idBranch,
      IdCustomer: body.idCustomer,
      Distancetraveledgps: body.distancetraveledgps,
      NumberOfHoursExcess: body.numberOfHoursExcess,
      NumberKmExcess: body.numberKmExcess,
      DayExcess: body.dayExcess,
      Discount: body.discount,
      CheckinCounter: body.checkinCounter,
      PriceInMonth: body.priceInMonth,
      PriceKmExtra: body.priceKmExtra,
      OtherExpenses: body.otherExpenses,
      TotalTrafic: body.totalTrafic,
      TotalMaintance: body.totalMaintance,
      TotalReceivedVehicle: body.totalReceivedVehicle,
      TransportationFees: body.transportationFees,
      Totaltax: body.totaltax,
      TotalTax: body.totaltax,
    };
  }

  update(body: BookingUpdateRequest): Observable<unknown> {
    return this.api.putData(`${this.base}/${body.id}`, body);
  }

  /**
   * Soft delete — matches API: DELETE Booking with `[FromQuery] long id` (see BookingController.Delete).
   */
  delete(id: number | string): Observable<boolean> {
    return this.api.deleteData<boolean>(this.base, { id: Number(id) });
  }

  private getPaginatedFromListFallback(
    params: BookingFilters,
  ): Observable<PaginatedAggregatorResponse<Booking>> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(params.fleetId, 'id'),
          BranchId: params.branchId ?? undefined,
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => (items ?? []).map(normalizeBooking)),
        map(items => this.applyFilters(items, params)),
        map(items => this.paginate(items, params.pageNumber, params.pageSize)),
        catchError(() => of(this.emptyPage(params.pageNumber, params.pageSize))),
      );
  }

  private applyFilters(items: Booking[], params: BookingFilters): Booking[] {
    const search = (params.search ?? '').trim().toLowerCase();
    const status = params.status?.trim();
    const startDate = params.startDate ? new Date(params.startDate) : null;
    const endDate = params.endDate ? new Date(params.endDate) : null;

    return items.filter(item => {
      if (item.isDeleted === true) {
        return false;
      }

      if (status && String(item.status) !== status) {
        return false;
      }

      const searchable = [
        item.id,
        item.bookingNumber,
        item.customerName,
        item.customerId,
        item.vehicleName,
        item.vehicleId,
        item.vehiclePlateNumber,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      if (search && !searchable.includes(search)) {
        return false;
      }

      if (startDate) {
        const itemStart = this.toDate(item.startDate);
        if (itemStart && itemStart < startDate) {
          return false;
        }
      }

      if (endDate) {
        const itemEnd = this.toDate(item.endDate);
        if (itemEnd && itemEnd > endDate) {
          return false;
        }
      }

      return true;
    });
  }

  private paginate(
    items: Booking[],
    pageNumber: number,
    pageSize: number,
  ): PaginatedAggregatorResponse<Booking> {
    const safePageNumber = Math.max(1, Number(pageNumber) || 1);
    const safePageSize = Math.max(1, Number(pageSize) || 20);
    const totalCount = items.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
    const start = (safePageNumber - 1) * safePageSize;
    const pagedItems = items.slice(start, start + safePageSize);

    return {
      items: pagedItems,
      pageNumber: safePageNumber,
      pageSize: safePageSize,
      totalCount,
      totalPages,
    };
  }

  private toDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }

    return parsed;
  }

  private emptyPage(pageNumber: number, pageSize: number): PaginatedAggregatorResponse<Booking> {
    return {
      items: [],
      pageNumber: Math.max(1, Number(pageNumber) || 1),
      pageSize: Math.max(1, Number(pageSize) || 20),
      totalCount: 0,
      totalPages: 1,
    };
  }

  private getByIdFromList(
    id: string,
    fleetId?: string,
    sourceError?: unknown,
  ): Observable<Booking> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(fleetId, 'id'),
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => (items ?? []).map(normalizeBooking)),
        map(items => items.find(item => String(item.id) === String(id))),
        map(item => {
          if (!item) {
            throw sourceError ?? new Error('Booking not found');
          }
          return item;
        }),
        catchError(error => throwError(() => sourceError ?? error)),
      );
  }
}
