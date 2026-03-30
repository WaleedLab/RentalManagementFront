import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { JournalEntry } from '../../models/journals/journal-entry.model';
import { normalizeJournalEntry } from '../../models/journals/journal-entry.normalizer';

@Injectable({
  providedIn: 'root',
})
export class JournalEntryService {
  private api = inject(BaseService);
  private readonly base = 'Journal';

  getList(fleetId: string): Observable<JournalEntry[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, { IdFleet: fleetId }).pipe(
      map(items => (items ?? []).map(normalizeJournalEntry)),
    );
  }
}

