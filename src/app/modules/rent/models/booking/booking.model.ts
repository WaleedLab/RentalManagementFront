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
 * Aligned with `CarRentalManagament.Application.Common.DTOs.BookingDto` (+ nested customer/vehicle when present).
 * Many fields are optional because list/payment DTOs expose a smaller surface.
 */
export interface Booking {
  id: string;
  bookingNumber?: string;
  numberBookingINBasame?: string;
  fleetId: string;
  fleetName?: string;
  branchId?: number | null;
  branchName?: string;
  customerId: string;
  customerName?: string;
  customerIqama?: string;
  vehicleId: string;
  vehicleImageUrl?: string;
  vehicleName?: string;
  vehiclePlateNumber?: string;
  vehicleSerialNumber?: string;
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
  distancetraveledgps?: string;
  numberOfHoursExcess?: number;
  numberKmExcess?: number;
  dayExcess?: number;
  discount?: number;
  checkoutCounter?: number;
  checkinCounter?: number;
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
  /** Required by backend `CreateBookingCommand.BirthDay` (non-nullable). */
  birthDay: string;
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
  idCustomer: number;
  /** Omit or `null` = do not change receipt amount; otherwise new paid-at-booking total. */
  paid?: number | null;
  dscription?: string;
  idVehicle: number;
  paymentType: number;
  bondType: number;
  status: number;
  idCash?: string;
  idBank?: string;
  paidCash: number;
  paidBank: number;
  idBooking: number;
  stutusbooking: number;
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
