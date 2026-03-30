import { Bank } from './bank.model';
import { pick } from '../shared/finance-normalizer.utils';

export function normalizeBank(raw: unknown): Bank {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    countingId: pick<string>(source, 'countingId', 'CountingId'),
    name: String(pick(source, 'name', 'Name') ?? ''),
    description: pick<string>(source, 'description', 'Description'),
    code: pick<string>(source, 'code', 'Code'),
    createdAt: pick<string>(source, 'createdAt', 'CreatedAt'),
    updatedAt: pick<string>(source, 'updatedAt', 'UpdatedAt'),
  };
}

