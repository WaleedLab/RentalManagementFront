import { PaymentCount } from './payment-count.model';
import { pick } from '../shared/finance-normalizer.utils';

export function normalizePaymentCount(raw: unknown): PaymentCount {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    idCustomer: pick<number>(source, 'idCustomer', 'IdCustomer'),
    paid: pick<number>(source, 'paid', 'Paid'),
    paymentType: pick<number>(source, 'paymentType', 'PaymentType'),
    status: pick<number>(source, 'status', 'Status'),
    idBooking: pick<number>(source, 'idBooking', 'IdBooking'),
  };
}

