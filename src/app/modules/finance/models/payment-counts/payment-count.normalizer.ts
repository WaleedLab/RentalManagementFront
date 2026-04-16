import { PaymentCount } from './payment-count.model';
import { pick } from '../shared/finance-normalizer.utils';

function toNumberOrUndefined(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function normalizePaymentCount(raw: unknown): PaymentCount {
  const source = (raw ?? {}) as Record<string, unknown>;
  const paymentNumber = toNumberOrUndefined(
    pick(
      source,
      'paymentNumber',
      'PaymentNumber',
      'paymentnumber',
      'Paymentnumber',
      'voucherNumber',
      'VoucherNumber',
      'paymentNo',
      'PaymentNo',
      'paymentCountNumber',
      'PaymentCountNumber',
      'number',
      'Number',
    ),
  );
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    paymentNumber,
    name: pick<string>(source, 'name', 'Name', 'title', 'Title'),
    description: pick<string>(source, 'description', 'Description', 'dscription', 'Dscription', 'note', 'Note'),
    idCustomer: pick<number>(source, 'idCustomer', 'IdCustomer'),
    customerName: pick<string>(source, 'customerName', 'CustomerName'),
    idVehicle: pick<number>(source, 'idVehicle', 'IdVehicle'),
    idBranch: pick<number>(source, 'idBranch', 'IdBranch'),
    branchName: pick<string>(source, 'branchName', 'BranchName'),
    paid: pick<number>(source, 'paid', 'Paid'),
    paymentType: pick<number>(source, 'paymentType', 'PaymentType'),
    bondType: pick<number>(source, 'bondType', 'BondType'),
    status: pick<number>(source, 'status', 'Status'),
    idCash: pick<string>(source, 'idCash', 'IdCash'),
    idBank: pick<string>(source, 'idBank', 'IdBank'),
    paidCash: pick<number>(source, 'paidCash', 'PaidCash'),
    paidBank: pick<number>(source, 'paidBank', 'PaidBank'),
    expenseCategory: pick<number>(source, 'expenseCategory', 'ExpenseCategory'),
    idBooking: pick<number>(source, 'idBooking', 'IdBooking'),
    idFinancialYear: pick<string | number>(source, 'idFinancialYear', 'IdFinancialYear'),
    createdAt: pick<string>(
      source,
      'createdAt',
      'CreatedAt',
      'creationDate',
      'CreationDate',
      'createdOn',
      'CreatedOn'
    ),
  };
}

