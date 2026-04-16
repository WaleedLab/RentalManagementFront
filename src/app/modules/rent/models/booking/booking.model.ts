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
  fleetId: string;
  fleetName?: string;
  branchId?: number | null;
  branchName?: string;
  customerId: string;
  customerName?: string;
  vehicleId: string;
  vehicleName?: string;
  vehiclePlateNumber?: string;
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

/** PUT /Booking/{id} — payment / bond fields per OpenAPI. */
export interface BookingUpdateRequest {
  id: number | string;
  idCustomer: number;
  paid: number;
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
