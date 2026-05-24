import { PendingAccountingEntry } from './pending-accounting-entry.model';

function pickString(raw: Record<string, unknown>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value != null && String(value).trim() !== '') {
      return String(value);
    }
  }
  return undefined;
}

function pickNumber(raw: Record<string, unknown>, ...keys: string[]): number | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (value != null && value !== '') {
      const num = Number(value);
      if (Number.isFinite(num)) {
        return num;
      }
    }
  }
  return undefined;
}

function pickBoolean(raw: Record<string, unknown>, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'boolean') {
      return value;
    }
    if (value === 'true' || value === 1 || value === '1') {
      return true;
    }
    if (value === 'false' || value === 0 || value === '0') {
      return false;
    }
  }
  return undefined;
}

export function normalizePendingAccountingEntry(raw: unknown): PendingAccountingEntry {
  const item = (raw ?? {}) as Record<string, unknown>;
  return {
    id: pickString(item, 'id', 'Id') ?? '',
    fleetId: pickString(item, 'fleetId', 'FleetId'),
    branchId: pickNumber(item, 'branchId', 'BranchId', 'BRANCHID'),
    paymentcountId: pickString(item, 'paymentcountId', 'PaymentcountId', 'PaymentCountId'),
    entryDate: pickString(item, 'entryDate', 'EntryDate', 'date', 'Date'),
    amount: pickNumber(item, 'amount', 'Amount'),
    description: pickString(item, 'description', 'Description'),
    isPosted: pickBoolean(item, 'isPosted', 'IsPosted'),
  };
}
