import { Injectable, inject } from '@angular/core';

import { Observable, catchError, map, of, throwError } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseService } from '../../../../shared/services/base/base.service';
import { buildFleetQueryParams, normalizeFleetId } from '../../../../shared/utils/fleet-query.utils';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import {
  Booking,
  BookingCreateRequest,
  BookingExtensionRequest,
  BookingFilters,
  BookingUpdateRequest,
  CloseBookingRequest,
  FinshBookingRequest,
  SuspendedBookingRequest,
} from '../../models';
import { normalizeBooking } from '../../models/booking/booking.normalizer';
import { TrafficBooking } from '../../models/booking/traffic-booking.model';
import { normalizeTrafficBooking } from '../../models/booking/traffic-booking.normalizer';

@Injectable({
  providedIn: 'root',
})
export class BookingService {
  private api = inject(BaseService);
  private readonly base = 'Booking';
  /**
   * Backend `CreateBookingCommand.BirthDay` is optional; when omitted the API still accepts a sentinel.
   */
  private static readonly UNKNOWN_BIRTH_DAY = '1900-01-01T00:00:00';

  getList(
    params: {
      fleetId?: string | null;
      branchId?: number | null;
      /** When true, sends an empty `Stutus` / `status` filter so the API can return bookings in every state. */
      includeAllStatuses?: boolean;
    } = {},
  ): Observable<Booking[]> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          ...buildFleetQueryParams(params.fleetId, 'id'),
          BranchId: params.branchId ?? undefined,
          ...(params.includeAllStatuses ? { Stutus: '', status: '' } : {}),
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => (items ?? []).map(normalizeBooking)),
        catchError(() => of([])),
      );
  }

  /**
   * `GetBookingsQuery` — `BookingRouting.List` → **`GET Booking/List`** (`IdFleet`, `BranchId`).
   * Uses {@link getList} with **all statuses** so violations can be linked to any booking.
   */
  getBookings(params: { fleetId?: string | null; branchId: number }): Observable<Booking[]> {
    return this.getList({
      fleetId: params.fleetId,
      branchId: params.branchId,
      includeAllStatuses: true,
    });
  }

  /**
   * `GetTrafficBookingsQuery` — `BookingRouting.Triffic` → **`GET Booking/List/traffic`**
   * (`IdFleet`, `BranchId`). Returns bookings eligible for traffic-violation linking.
   */
  getTrafficBookings(params: {
    fleetId?: string | null;
    branchId: number;
  }): Observable<TrafficBooking[]> {
    return this.api
      .getData<unknown[]>(
        `${this.base}/List/traffic`,
        {
          ...buildFleetQueryParams(params.fleetId, 'id'),
          BranchId: params.branchId,
        },
        { suppressErrorToast: true },
      )
      .pipe(
        map(items => (items ?? []).map(normalizeTrafficBooking).filter(b => b.id > 0)),
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
          Stutus: this.toBackendBookingStatusEnumName(params.status),
          status: params.status || undefined,
          OrderByDirection: params.orderByDirection ?? 'DESC',
          OrderBy: params.orderBy ?? 'CreatedAt',
        },
        { suppressErrorToast: true },
      )
      .pipe(map(response => normalizePaginatedResponse(response, normalizeBooking)));
  }

  getStatusCounts(params: {
    fleetId?: string | null;
    branchId?: number | null;
    period?: BookingStatusCountsPeriod;
  } = {}): Observable<BookingStatusCountsResponse> {
    const normalizedFleetId = normalizeFleetId(params.fleetId);
    return this.api.getData<BookingStatusCountsResponse>(
      `${this.base}/StatusCounts`,
      {
        FleetId: normalizedFleetId ?? undefined,
        BranchId: params.branchId ?? undefined,
        Period: params.period ?? 'ThisMonth',
      },
      { suppressErrorToast: true },
    ).pipe(
      catchError(() => of({ totalCount: 0, statusCounts: [] })),
    );
  }

  getById(id: string, fleetId?: string | null): Observable<Booking> {
    const normalizedFleetId = normalizeFleetId(fleetId);
    if (!normalizedFleetId) {
      return throwError(() => new Error('FleetId is required to load booking details'));
    }

    const encodedId = encodeURIComponent(String(id));
    const encodedFleetId = encodeURIComponent(normalizedFleetId);
    return this.api.getData<unknown>(`${this.base}/${encodedId}/${encodedFleetId}`).pipe(
      map(normalizeBooking),
    );
  }

  create(body: BookingCreateRequest): Observable<unknown> {
    return this.api.postData(this.base, this.toCreateBookingPayload(body), {
      suppressErrorToast: true,
    });
  }

  /**
   * Backend model binder in this solution often expects PascalCase alongside camelCase
   * (see `PaymentCountService` / `VehicleService`). Duplicate critical fields here to avoid 400.
   */
  private toCreateBookingPayload(body: BookingCreateRequest): Record<string, unknown> {
    const { birthDay: birthDayRaw, ...bodyWithoutBirthDay } = body;
    const birthDay = birthDayRaw?.trim() || BookingService.UNKNOWN_BIRTH_DAY;
    return {
      ...bodyWithoutBirthDay,
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
      BirthDay: birthDay,
      birthDay,
      NumberOfHoursExcess: body.numberOfHoursExcess,
      NumberKmExcess: body.numberKmExcess,
      DayExcess: body.dayExcess,
      NumberBookingINBasame: body.numberBookingINBasame,
      FleetId: body.fleetId,
      IdBranch: body.idBranch,
      BranchId: body.idBranch,
      IdCustomer: body.idCustomer,
      Distancetraveledgps: body.distancetraveledgps,
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
    return this.api.putData(`${this.base}/${body.id}`, this.toUpdateBookingPayload(body));
  }

  extend(body: BookingExtensionRequest): Observable<unknown> {
    const payload = this.toExtensionBookingPayload(body);
    // Backend may expose Extension as PUT (405 on POST). Try PUT first on canonical route.
    return this.api.putData(`${this.base}/extension`, payload, { suppressErrorToast: true }).pipe(
      catchError(() => this.api.postData(`${this.base}/extension`, payload, { suppressErrorToast: true })),
      catchError(() => this.api.putData(`${this.base}/Extension`, payload, { suppressErrorToast: true })),
      catchError(() => this.api.postData(`${this.base}/Extension`, payload, { suppressErrorToast: true })),
      catchError(() => this.api.putData(`${this.base}/Extend`, payload, { suppressErrorToast: true })),
      catchError(() => this.api.postData(`${this.base}/Extend`, payload)),
    );
  }

  /**
   * `CloseBookingCommand` — **POST `Booking/close`**
   * (sets `Stutus` to `close`; generic PUT update does not change status on the server).
   */
  close(body: CloseBookingRequest): Observable<unknown> {
    const payload = this.toCloseBookingPayload(body);
    return this.api.postData(`${this.base}/close`, payload, { suppressErrorToast: true }).pipe(
      catchError(() => this.api.postData(`${this.base}/Close`, payload)),
    );
  }

  /**
   * `FinshBookingCommand` — `BookingRouting.Finsh` → **POST `Booking/finsh`**
   * (history + optional receipt + vehicle available). Falls back to `Finsh` if routing differs.
   */
  finish(body: FinshBookingRequest): Observable<unknown> {
    const payload = this.toFinishBookingPayload(body);
    return this.api.postData(`${this.base}/finsh`, payload, { suppressErrorToast: true }).pipe(
      catchError(() => this.api.postData(`${this.base}/Finsh`, payload)),
    );
  }

  /**
   * `SuspendedBookingCommand` — try common route spellings for ASP.NET controllers.
   */
  suspend(body: SuspendedBookingRequest): Observable<unknown> {
    const payload = this.toSuspendedBookingPayload(body);
    return this.api.postData(`${this.base}/suspended`, payload, { suppressErrorToast: true }).pipe(
      catchError(() => this.api.postData(`${this.base}/Suspended`, payload, { suppressErrorToast: true })),
      catchError(() => this.api.postData(`${this.base}/suspend`, payload)),
    );
  }

  /**
   * Mirrors `toCreateBookingPayload`: duplicate PascalCase for ASP.NET binders.
   * When `paid` is `undefined`, `Paid` is omitted (JSON.stringify drops undefined) so the server
   * treats the amount as unchanged; `paid: null` sends explicit null for the same semantics.
   */
  private toUpdateBookingPayload(body: BookingUpdateRequest): Record<string, unknown> {
    const out: Record<string, unknown> = {
      id: body.id,
      Id: body.id,
      idCustomer: body.idCustomer,
      IdCustomer: body.idCustomer,
      idVehicle: body.idVehicle,
      IdVehicle: body.idVehicle,
      idBranch: body.idBranch,
      IdBranch: body.idBranch,
      checkoutCounter: body.checkoutCounter,
      CheckoutCounter: body.checkoutCounter,
      checkinCounter: body.checkinCounter,
      CheckinCounter: body.checkinCounter,
      countOfDay: body.countOfDay,
      CountOfDay: body.countOfDay,
      total: body.total,
      Total: body.total,
      TOTAL: body.total,
      discount: body.discount,
      Discount: body.discount,
      priceInDay: body.priceInDay,
      PriceInDay: body.priceInDay,
      priceInMonth: body.priceInMonth,
      PriceInMonth: body.priceInMonth,
      allowTo: body.allowTo,
      AllowTo: body.allowTo,
      countKMExtra: body.countKMExtra,
      CountKMExtra: body.countKMExtra,
      priceHoureExtra: body.priceHoureExtra,
      PriceHoureExtra: body.priceHoureExtra,
      priceKmExtra: body.priceKmExtra,
      PriceKmExtra: body.priceKmExtra,
      otherExpenses: body.otherExpenses,
      OtherExpenses: body.otherExpenses,
      totaltax: body.totaltax,
      Totaltax: body.totaltax,
      startDate: body.startDate,
      StartDate: body.startDate,
      endDate: body.endDate,
      EndDate: body.endDate,
      dateReturnVehical: body.dateReturnVehical,
      DateReturnVehical: body.dateReturnVehical,
      note: body.note,
      Note: body.note,
      placeUSE: body.placeUSE,
      PlaceUSE: body.placeUSE,
      numberBookingINBasame: body.numberBookingINBasame,
      NumberBookingINBasame: body.numberBookingINBasame,
      distancetraveledgps: body.distancetraveledgps,
      Distancetraveledgps: body.distancetraveledgps,
      totalTrafic: body.totalTrafic,
      TotalTrafic: body.totalTrafic,
      totalMaintance: body.totalMaintance,
      TotalMaintance: body.totalMaintance,
      totalReceivedVehicle: body.totalReceivedVehicle,
      TotalReceivedVehicle: body.totalReceivedVehicle,
      transportationFees: body.transportationFees,
      TransportationFees: body.transportationFees,
      idCountingCustVehicle: body.idCountingCustVehicle,
      IdCountingCustVehicle: body.idCountingCustVehicle,
      stutus: body.stutus,
      Stutus: body.stutus,
      paymentType: body.paymentType,
      PaymentType: body.paymentType,
      bondType: body.bondType,
      BondType: body.bondType,
      idCash: body.idCash,
      IdCash: body.idCash,
      idBank: body.idBank,
      IdBank: body.idBank,
      paidCash: body.paidCash,
      PaidCash: body.paidCash,
      paidBank: body.paidBank,
      PaidBank: body.paidBank,
    };

    if (body.paid !== undefined) {
      out['paid'] = body.paid;
      out['Paid'] = body.paid;
    }

    return out;
  }

  private toExtensionBookingPayload(body: BookingExtensionRequest): Record<string, unknown> {
    return {
      idBranch: body.idBranch,
      IdBranch: body.idBranch,
      idBooking: body.idBooking,
      IdBooking: body.idBooking,
      fleetId: body.fleetId,
      FleetId: body.fleetId,
      countOfDay: body.countOfDay,
      CountOfDay: body.countOfDay,
      note: body.note,
      Note: body.note,
      datePayment: body.datePayment,
      DatePayment: body.datePayment,
      paid: body.paid,
      Paid: body.paid,
      idBank: body.idBank,
      IdBank: body.idBank,
      idCash: body.idCash,
      IdCash: body.idCash,
      paidCash: body.paidCash,
      PaidCash: body.paidCash,
      paidBank: body.paidBank,
      PaidBank: body.paidBank,
      paymentType: body.paymentType,
      PaymentType: body.paymentType,
    };
  }

  /** Duplicate camelCase + PascalCase for ASP.NET binders (`FinshBookingCommand`). */
  private toFinishBookingPayload(b: FinshBookingRequest): Record<string, unknown> {
    const out: Record<string, unknown> = {
      id: b.id,
      Id: b.id,
      dateReturnVehical: b.dateReturnVehical,
      DateReturnVehical: b.dateReturnVehical,
      numberOfHoursExcess: b.numberOfHoursExcess,
      NumberOfHoursExcess: b.numberOfHoursExcess,
      numberKmExcess: b.numberKmExcess,
      NumberKmExcess: b.numberKmExcess,
      dayExcess: b.dayExcess,
      DayExcess: b.dayExcess,
      allowToall: b.allowToall,
      AllowToall: b.allowToall,
      pricekmAllExcess: b.pricekmAllExcess,
      PricekmAllExcess: b.pricekmAllExcess,
      priceoAllHoure: b.priceoAllHoure,
      PriceoAllHoure: b.priceoAllHoure,
      priceAllDayExcess: b.priceAllDayExcess,
      PriceAllDayExcess: b.priceAllDayExcess,
      idVehicle: b.idVehicle,
      IdVehicle: b.idVehicle,
      idCustomer: b.idCustomer,
      IdCustomer: b.idCustomer,
      idBranch: b.idBranch,
      IdBranch: b.idBranch,
      fleetId: b.fleetId,
      FleetId: b.fleetId,
      checkoutCounter: b.checkoutCounter,
      CheckoutCounter: b.checkoutCounter,
      checkinCounter: b.checkinCounter,
      CheckinCounter: b.checkinCounter,
      countOfDay: b.countOfDay,
      CountOfDay: b.countOfDay,
      total: b.total,
      Total: b.total,
      TOTAL: b.total,
      countKMExtra: b.countKMExtra,
      CountKMExtra: b.countKMExtra,
      priceHoureExtra: b.priceHoureExtra,
      PriceHoureExtra: b.priceHoureExtra,
      priceKmExtra: b.priceKmExtra,
      PriceKmExtra: b.priceKmExtra,
      otherExpenses: b.otherExpenses,
      OtherExpenses: b.otherExpenses,
      totalTrafic: b.totalTrafic,
      TotalTrafic: b.totalTrafic,
      totalMaintance: b.totalMaintance,
      TotalMaintance: b.totalMaintance,
      transportationFees: b.transportationFees,
      TransportationFees: b.transportationFees,
      paid: b.paid,
      Paid: b.paid,
      paymentType: b.paymentType,
      PaymentType: b.paymentType,
    };

    if (b.note !== undefined && b.note !== '') {
      out['note'] = b.note;
      out['Note'] = b.note;
    }
    if (b.discount !== undefined && b.discount !== null) {
      out['discount'] = b.discount;
      out['Discount'] = b.discount;
    }
    if (b.totaltax !== undefined && b.totaltax !== null) {
      out['totaltax'] = b.totaltax;
      out['Totaltax'] = b.totaltax;
    }
    if (b.distancetraveledgps) {
      out['distancetraveledgps'] = b.distancetraveledgps;
      out['Distancetraveledgps'] = b.distancetraveledgps;
    }
    if (b.idCountingCustVehicle) {
      out['idCountingCustVehicle'] = b.idCountingCustVehicle;
      out['IdCountingCustVehicle'] = b.idCountingCustVehicle;
    }
    if (b.idBank) {
      out['idBank'] = b.idBank;
      out['IdBank'] = b.idBank;
    }
    if (b.idCash) {
      out['idCash'] = b.idCash;
      out['IdCash'] = b.idCash;
    }
    if (b.paidCash !== undefined && b.paidCash !== null) {
      out['paidCash'] = b.paidCash;
      out['PaidCash'] = b.paidCash;
    }
    if (b.paidBank !== undefined && b.paidBank !== null) {
      out['paidBank'] = b.paidBank;
      out['PaidBank'] = b.paidBank;
    }

    return out;
  }

  /** `CloseBookingCommand` — PascalCase duplicates for ASP.NET model binding. */
  private toCloseBookingPayload(b: CloseBookingRequest): Record<string, unknown> {
    const out: Record<string, unknown> = {
      id: b.id,
      Id: b.id,
      dateReturnVehical: b.dateReturnVehical,
      DateReturnVehical: b.dateReturnVehical,
      checkinCounter: b.checkinCounter,
      CheckinCounter: b.checkinCounter,
      idVehicle: b.idVehicle,
      IdVehicle: b.idVehicle,
      idCustomer: b.idCustomer,
      IdCustomer: b.idCustomer,
      idBranch: b.idBranch,
      IdBranch: b.idBranch,
      fleetId: b.fleetId,
      FleetId: b.fleetId,
      paid: b.paid,
      Paid: b.paid,
      paymentType: b.paymentType,
      PaymentType: b.paymentType,
    };
    if (b.note !== undefined && b.note !== '') {
      out['note'] = b.note;
      out['Note'] = b.note;
    }
    if (b.idBank) {
      out['idBank'] = b.idBank;
      out['IdBank'] = b.idBank;
    }
    if (b.idCash) {
      out['idCash'] = b.idCash;
      out['IdCash'] = b.idCash;
    }
    if (b.paidCash !== undefined && b.paidCash !== null) {
      out['paidCash'] = b.paidCash;
      out['PaidCash'] = b.paidCash;
    }
    if (b.paidBank !== undefined && b.paidBank !== null) {
      out['paidBank'] = b.paidBank;
      out['PaidBank'] = b.paidBank;
    }
    return out;
  }

  /** `SuspendedBookingCommand` — finish fields plus `BondType` and `Stutus`. */
  private toSuspendedBookingPayload(b: SuspendedBookingRequest): Record<string, unknown> {
    return {
      ...this.toFinishBookingPayload(b),
      bondType: b.bondType,
      BondType: b.bondType,
      stutus: b.stutus,
      Stutus: b.stutus,
    };
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

  private toBackendBookingStatusEnumName(status?: BookingFilters['status']): string | undefined {
    if (!status || status === 'Unknown') {
      return undefined;
    }
    return status;
  }

}

export interface BookingStatusCountsResponse {
  totalCount: number;
  statusCounts: BookingStatusCountItem[];
}

export interface BookingStatusCountItem {
  status: string;
  statusDisplayName: string;
  count: number;
  includedStatuses: string[];
}

export type BookingStatusCountsPeriod = 'ThisMonth' | 'Last3Months' | 'ThisYear';
