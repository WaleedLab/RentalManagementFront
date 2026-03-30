import { CashAccount } from './cash-account.model';
import { pick } from '../shared/finance-normalizer.utils';

export function normalizeCashAccount(raw: unknown): CashAccount {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    countingId: pick<string>(source, 'countingId', 'CountingId'),
    name: String(pick(source, 'name', 'Name') ?? ''),
    description: pick<string>(source, 'description', 'Description'),
    fleetId: pick<string>(source, 'fleetId', 'FleetId'),
    createdAt: pick<string>(source, 'createdAt', 'CreatedAt'),
    updatedAt: pick<string>(source, 'updatedAt', 'UpdatedAt'),
  };
}

