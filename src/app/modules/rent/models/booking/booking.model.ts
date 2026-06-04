/**
 * Workflow state from `bookingEnum` / `Stutusbooking` (CarRentalManagament.Application.Common.Enums.bookingEnum).
 * `Unknown` covers missing or future enum values.
 */
export type BookingStatus =
  | 'open'
  | 'finsh'
  | 'Suspended_due_to_accident'
  | 'translate'
  | 'close'
  | 'extension'
  | 'Suspended_due_to_sum_money'
  | 'Payment_on_account'
  | 'Unknown';

/**
 * Normalized booking row for list/detail screens.
 *
 * **Detail (`GET …/Booking/{id}/{fleetId}`)** maps from
 * `CarRentalManagament.Application.Features.Booking.GetBookingByIdQueryResponse`
 * (flat snapshot: `CustomerNameAr`, `VehiclePlatnumber`, `CategoryVehicleName`, `Color`, `Urllogo`,
 * `Stutus`, `TOTAL`, `DateReturnVehical`, `NumberBookingINBasame`, `BranchBuldingNumber`, `CountingCustVehicleName`, …).
 *
 * **List / other DTOs** may omit fields or nest `customer` / `vehicle` / `fleet`; the normalizer keeps fallbacks.
 */
export interface Booking {
  id: string;
  bookingNumber?: string;
  /** Primary payment / document reference on the booking (`PaymentNumber`). */
  paymentNumber?: string;
  numberBookingINBasame?: string;
  fleetId: string;
  fleetName?: string;
  /** Fleet / company logo (`Urllogo`). */
  urlLogo?: string;
  /** VAT / tax registration (`TaxNumber`). */
  taxNumber?: string;
  branchId?: number | null;
  branchName?: string;
  /** From `GetBookingById` branch address fields. */
  branchStreet?: string;
  branchNeighborHood?: string;
  branchBuildingNumber?: string;
  branchCity?: string;
  customerId: string;
  /** Snapshot Arabic name (`CustomerNameAr` / `NameAr` / nested customer). */
  customerName?: string;
  /** `CustomerNameEn` when present on booking-by-id DTOs. */
  customerNameEn?: string;
  customerIqama?: string;
  /** Present when GetById (or nested `customer`) includes profile fields. */
  customerNationality?: string;
  customerMobile?: string;
  customerAddress?: string;
  customerDrivingLicenseNumber?: string;
  customerDrivingLicenseExpiry?: string;
  customerBirthDay?: string;
  vehicleId: string;
  vehicleImageUrl?: string;
  vehicleName?: string;
  vehiclePlateNumber?: string;
  vehicleSerialNumber?: string;
  vehicleYear?: number;
  vehicleColor?: string;
  vehicleEngine?: string;
  vehicleCategoryLabel?: string;
  statusDisplayName?: string;
  startDate: string;
  endDate: string;
  pickupDate?: string;
  returnDate?: string;
  /** Contract total — maps `TOTAL`, `total`, `totalAmount`, etc. */
  totalAmount?: number;
  /** From `Paidtotal` / `paidtotal` on BookingDto. */
  paidtotal?: number;
  depositAmount?: number;
  paidAmount?: number;
  status: BookingStatus;
  notes?: string;

  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string;
  deletedBy?: string;
  distancetraveledgps?: string;
  numberOfHoursExcess?: number;
  numberKmExcess?: number;
  dayExcess?: number;
  discount?: number;
  checkoutCounter?: number;
  checkinCounter?: number;
  checkoutPhotoFrontUrl?: string;
  checkoutPhotoRightUrl?: string;
  checkoutPhotoLeftUrl?: string;
  checkoutPhotoBackUrl?: string;
  checkoutPhotoInteriorUrl?: string;
  checkinPhotoFrontUrl?: string;
  checkinPhotoRightUrl?: string;
  checkinPhotoLeftUrl?: string;
  checkinPhotoBackUrl?: string;
  checkinPhotoInteriorUrl?: string;
  countOfDay?: number;
  /** Soft delete — aligns with DB/API `IsDeleted` (replaces legacy `IsDelete`). */
  isDeleted?: boolean;
  isprview?: boolean;
  priceInDay?: number;
  priceInMonth?: number;
  allowTo?: number;
  countKMExtra?: number;
  priceHoureExtra?: number;
  priceKmExtra?: number;
  otherExpenses?: number;
  totalTrafic?: number;
  totalMaintance?: number;
  totalReceivedVehicle?: number;
  transportationFees?: number;
  totaltax?: number | null;
  placeUSE?: string;
  idCountingCustVehicle?: string;
  /** From `GetBookingByIdQueryResponse.CountingCustVehicleName` (chart of accounts, Arabic). */
  countingCustVehicleName?: string;
  updatedBy?: string;
}

export interface BookingFilters {
  fleetId?: string;
  branchId?: number | null;
  status?: BookingStatus | '';
  startDate?: string;
  endDate?: string;
  search?: string;
  orderByDirection?: string;
  orderBy?: string;
  pageNumber: number;
  pageSize: number;
}

/** POST /Booking — contract matches backend OpenAPI (customer snapshot + rental terms). */
export interface BookingCreateRequest {
  nameAr: string;
  firstMobileNumber: string;
  address?: string;
  idNationality: string;
  dateDrivinglicense: string;
  nationality: string;
  idVehicle: number;
  checkoutCounter: number;
  total: number;
  startDate: string;
  endDate: string;
  countOfDay: number;
  dateReturnVehical: string;
  /** Legacy optional field; backend now sets booking status server-side on create. */
  stutus?: number | string;
  priceInDay: number;
  allowTo: number;
  countKMExtra: number;
  priceHoureExtra: number;
  paid: number;
  note?: string;
  placeUSE?: string;
  idBank?: string;
  idCash?: string;
  paidCash: number;
  paidBank: number;
  paymentType: number;
  /** OpenAPI / command: `IdCountingCustVehicle`. */
  idCountingCustVehicle?: string;
  /** @deprecated Prefer `idCountingCustVehicle`; kept for older payloads. */
  idCountingCust?: string;
  /** Sent to backend `CreateBookingCommand.BirthDay` when a valid Gregorian date is available. */
  birthDay?: string;
  numberBookingINBasame: string;
  fleetId: string;
  /** Required by backend `CreateBookingCommand.IdBranch` (non-nullable long). */
  idBranch: number;
  idCustomer?: number;
  distancetraveledgps?: string;
  numberOfHoursExcess?: number;
  numberKmExcess?: number;
  dayExcess?: number;
  discount?: number;
  checkinCounter?: number;
  priceInMonth?: number;
  priceKmExtra?: number;
  otherExpenses?: number;
  totalTrafic?: number;
  totalMaintance?: number;
  totalReceivedVehicle?: number;
  transportationFees?: number;
  totaltax?: number;
}

/**
 * PUT `/Booking/{id}` — payment / bond fields.
 * Backend (`UpdateBookingCommandHandler` / `SyncBookingReceiptPaymentAsync`): `Paid` as `decimal?` —
 * use **`null`** or **omit** `paid` to leave the booking receipt / bond line amount unchanged while still
 * allowing cash/bank account changes via other fields. Send an explicit number (with `paymentType` when
 * first creating a receipt) to set or change the amount.
 */
export interface BookingUpdateRequest {
  id: number | string;
  idCustomer?: number;
  idVehicle?: number;
  idBranch?: number;
  checkoutCounter?: number;
  checkinCounter?: number;
  countOfDay?: number;
  total?: number;
  discount?: number;
  priceInDay?: number;
  priceInMonth?: number;
  allowTo?: number;
  countKMExtra?: number;
  priceHoureExtra?: number;
  priceKmExtra?: number;
  otherExpenses?: number;
  totaltax?: number;
  startDate?: string;
  endDate?: string;
  dateReturnVehical?: string;
  note?: string;
  placeUSE?: string;
  numberBookingINBasame?: string;
  distancetraveledgps?: string;
  totalTrafic?: number;
  totalMaintance?: number;
  totalReceivedVehicle?: number;
  transportationFees?: number;
  idCountingCustVehicle?: string;
  stutus?: string;
  /** Omit or `null` = do not change receipt amount; otherwise new paid-at-booking total. */
  paid?: number | null;
  paymentType?: number;
  bondType?: number;
  idCash?: string;
  idBank?: string;
  paidCash?: number;
  paidBank?: number;
}

/** POST Booking/Extension — maps to ExtensionBookingCommand. */
export interface BookingExtensionRequest {
  idBranch: number;
  idBooking: number;
  fleetId: string;
  countOfDay: number;
  note: string;
  datePayment: string;
  paid: number;
  idBank?: string;
  idCash?: string;
  paidCash?: number;
  paidBank?: number;
  paymentType: number;
}

/**
 * POST `Booking/finsh` — maps to `FinshBookingCommand` (same property names as the MediatR model;
 * `AllowToall`, `PricekmAllExcess`, `PriceoAllHoure` follow backend spelling).
 */
export interface FinshBookingRequest {
  id: number;
  dateReturnVehical: string;
  numberOfHoursExcess: number;
  numberKmExcess: number;
  dayExcess: number;
  note?: string;
  allowToall: number;
  pricekmAllExcess: number;
  priceoAllHoure: number;
  priceAllDayExcess: number;
  idVehicle: number;
  idCustomer: number;
  idBranch: number;
  fleetId: string;
  checkoutCounter: number;
  checkinCounter: number;
  countOfDay: number;
  total: number;
  countKMExtra: number;
  priceHoureExtra: number;
  priceKmExtra: number;
  otherExpenses: number;
  discount?: number | null;
  totaltax?: number | null;
  distancetraveledgps?: string;
  totalTrafic: number;
  totalMaintance: number;
  transportationFees: number;
  idCountingCustVehicle?: string;
  paid: number;
  idBank?: string;
  idCash?: string;
  paidCash?: number | null;
  paidBank?: number | null;
  paymentType: number;
}

/** POST `Booking/suspended` — `SuspendedBookingCommand` / `bookingSuspendedEnum`. */
export type BookingSuspendedStatus = 'Suspended_due_to_accident' | 'Suspended_due_to_sum_money';

export interface SuspendedBookingRequest extends FinshBookingRequest {
  bondType: number;
  stutus: BookingSuspendedStatus;
}

/**
 * POST `Booking/TranslateBooking` — `TranslateBookingCommand` (sets `Stutus` to `translate`).
 */
export interface TranslateBookingRequest {
  id: number;
  fleetId: string;
}

/** POST `Booking/close` — maps to `CloseBookingCommand` (sets `Stutus` to `close`, history, vehicle available). */
export interface CloseBookingRequest {
  id: number;
  dateReturnVehical: string;
  note?: string;
  checkinCounter: number;
  idVehicle: number;
  idCustomer: number;
  idBranch: number;
  fleetId: string;
  paid: number;
  paymentType: number;
  idBank?: string;
  idCash?: string;
  paidCash?: number;
  paidBank?: number;
}

/**
 * POST `Booking/FinshAfterSuspended` — `FinshAfterSuspendedBookingCommand`.
 * Used when closing a suspended contract (accident or amount due): records receipt and marks `finsh`.
 */
export interface FinshAfterSuspendedBookingRequest {
  id: number;
  fleetId: string;
  paid: number;
  paymentType: number;
  bondType: number;
  idBank?: string;
  idCash?: string;
  paidCash?: number | null;
  paidBank?: number | null;
}

const BOOKING_MONEY_EPS = 1e-6;

/**
 * Value for `BookingUpdateRequest.paid` when mapping from a form.
 * - If `snapshotPaid` is **omitted** (`undefined`), returns `undefined` so the PUT body omits `paid`
 *   (server keeps the current receipt amount).
 * - If `snapshotPaid` is provided and equals `editedPaid`, returns **`null`** (explicit “no change”).
 * - Otherwise returns the new non‑negative amount.
 */
export function paidForBookingUpdateRequest(
  editedPaid: number,
  snapshotPaid?: number | null,
): number | null | undefined {
  if (snapshotPaid === undefined) {
    return undefined;
  }
  const e = Math.max(0, Number(editedPaid) || 0);
  const p = Math.max(0, Number(snapshotPaid) || 0);
  if (Math.abs(e - p) < BOOKING_MONEY_EPS) {
    return null;
  }
  return e;
}

/** Legacy full-contract shape (not used for POST after API alignment). */
export interface BookingUpsertRequest {
  id?: string;
  idVehicle: number;
  idCustomer: number;
  idBranch: number;
  fleetId: string;
  distancetraveledgps?: string;
  numberOfHoursExcess: number;
  numberKmExcess: number;
  dayExcess: number;
  discount: number;
  checkoutCounter: number;
  checkinCounter: number;
  countOfDay: number;
  priceInDay: number;
  priceInMonth: number;
  allowTo: number;
  countKMExtra: number;
  priceHoureExtra: number;
  priceKmExtra: number;
  otherExpenses: number;
  total: number;
  startDate: string;
  endDate: string;
  dateReturnVehical: string;
  note?: string;
  placeUSE?: string;
  totalTrafic: number;
  totalMaintance: number;
  totalReceivedVehicle: number;
  transportationFees: number;
  totaltax: number;
  numberBookingINBasame?: string;
}
