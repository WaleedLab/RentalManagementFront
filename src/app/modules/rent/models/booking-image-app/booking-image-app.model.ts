/** `GetBookingImageAppByIdBookingsQueryResponse` */
export interface BookingImageApp {
  id: string;
  fleetId: string;
  idBooking: number;
  /** Booking workflow state when photos were captured (`bookingEnum` name string). */
  status: string;
  imageCounter?: string;
  imageFront?: string;
  imageBack?: string;
  imageRight?: string;
  imageLeft?: string;
}
