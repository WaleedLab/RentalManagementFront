import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';

import { BaseService } from '../../../../shared/services/base/base.service';
import { CountingEntry } from '../../models/counting/counting-entry.model';
import { normalizeCountingEntry } from '../../models/counting/counting-entry.normalizer';

@Injectable({
  providedIn: 'root',
})
export class CountingEntryService {
  private api = inject(BaseService);
  private readonly base = 'Counting';

  getList(fleetId: string): Observable<CountingEntry[]> {
    return this.api.getData<unknown[]>(`${this.base}/List`, { IdFleet: fleetId }).pipe(
      map(items => (items ?? []).map(normalizeCountingEntry)),
    );
  }
}

