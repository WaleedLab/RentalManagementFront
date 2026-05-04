export interface PaymentCount {
  id: string;
  /** Voucher / document number — string in `GetPaymentcountByIdBookingQueryResponse.PaymentNumber`, may be numeric in other DTOs. */
  paymentNumber?: string | number;
  name?: string;
  description?: string;
  idCustomer?: number;
  customerName?: string;
  taxNumber?: string;
  urllogo?: string;
  idVehicle?: string | number;
  vehicleName?: string;
  plateNumber?: string;
  yearMake?: string | number;
  vehicleCategory?: string;
  idBranch?: number;
  branchName?: string;
  branchStreet?: string;
  branchNeighborHood?: string;
  branchBuldingNumber?: string;
  branchCity?: string;
  paid?: number;
  paymentType?: number;
  bondType?: number;
  status?: number;
  idCash?: string;
  idBank?: string;
  paidCash?: number;
  paidBank?: number;
  expenseCategory?: number;
  idBooking?: number;
  /** Booking workflow flag from payment-count DTO when present. */
  stutusbooking?: number;
  idFinancialYear?: string | number;
  createdAt?: string;
  details?: Array<Record<string, unknown>>;
}

export interface CreatePaymentCountRequest {
  idCustomer?: number;
  paid: number;
  dscription: string;
  idVehicle?: number;
  idBranch: number;
  paymentType: number;
  bondType: number;
  status: number;
  idCash?: string;
  idBank?: string;
  paidCash: number;
  paidBank: number;
  expenseCategory?: number;
  idBooking?: number;
  stutusbooking?: number;
  idFinancialYear?: string;
  fleetId: string;
  details?: PaymentCountDetailLineRequest[];
}

export interface PaymentCountDetailLineRequest {
  idCounting: string;
  price: number;
  node?: string;
  idBranch?: number;
  idFinancialYear?: string;
}

