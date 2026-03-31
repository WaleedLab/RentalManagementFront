export interface PaymentCount {
  id: string;
  idCustomer?: number;
  paid?: number;
  paymentType?: number;
  status?: number;
  idBooking?: number;
}

export interface CreatePaymentCountRequest {
  idCustomer: number;
  paid: number;
  dscription: string;
  idVehicle: number;
  idBranch: number;
  paymentType: number;
  bondType: number;
  status: number;
  idCash?: string;
  idBank?: string;
  paidCash: number;
  paidBank: number;
  idBooking: number;
  stutusbooking: number;
  fleetId: string;
}

