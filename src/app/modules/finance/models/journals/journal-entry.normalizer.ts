import { JournalEntry } from './journal-entry.model';
import { pick } from '../shared/finance-normalizer.utils';

export function normalizeJournalEntry(raw: unknown): JournalEntry {
  const source = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(pick(source, 'id', 'Id') ?? ''),
    journalNumper: pick<number>(source, 'journalNumper', 'JournalNumper'),
    date: pick<string>(source, 'date', 'Date'),
    node: pick<string>(source, 'node', 'Node'),
    balannce: pick<number>(source, 'balannce', 'Balannce'),
    isManual: pick<boolean>(source, 'isManual', 'IsManual'),
  };
}

