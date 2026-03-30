import { CountingEntry } from './counting-entry.model';
import { pick } from '../shared/finance-normalizer.utils';

export function normalizeCountingEntry(raw: unknown): CountingEntry {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    countingNumber: pick<number>(source, 'countingNumber', 'CountingNumber'),
    countingLevel: pick<number>(source, 'countingLevel', 'CountingLevel'),
    nameAr: pick<string>(source, 'nameAr', 'NameAr'),
    nameEn: pick<string>(source, 'nameEn', 'NameEn'),
    balannce: pick<number>(source, 'balannce', 'Balannce'),
  };
}

