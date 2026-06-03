import { Injectable, inject } from '@angular/core';
import { map, Observable, throwError } from 'rxjs';

import { BaseService } from '../../../shared/services/base/base.service';
import { normalizeFleetId } from '../../../shared/utils/fleet-query.utils';
import {
  MaintenanceDetail,
  MaintenanceDetailCreateRequest,
} from '../models/maintenance-detail.model';
import { normalizeMaintenanceDetail } from '../models/maintenance-detail.normalizer';

/**
 * Matches `MaintenaceDetailRouting` (backend spelling: MaintenaceDetail).
 */
@Injectable({ providedIn: 'root' })
export class MaintenanceDetailService {
  private api = inject(BaseService);
  private readonly base = 'MaintenaceDetail';

  getList(idMaintenance: number, fleetId: string): Observable<MaintenanceDetail[]> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }
    if (!Number.isFinite(idMaintenance) || idMaintenance <= 0) {
      return throwError(() => new Error('IdMaintenance is required'));
    }

    return this.api
      .getData<unknown[]>(
        `${this.base}/List`,
        {
          IdMaintenance: idMaintenance,
          idMaintenance,
          FleetId: fid,
          fleetId: fid,
        },
        { suppressErrorToast: true },
      )
      .pipe(map(items => (items ?? []).map(normalizeMaintenanceDetail)));
  }

  create(body: MaintenanceDetailCreateRequest): Observable<MaintenanceDetail[]> {
    const fid = normalizeFleetId(body.fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }

    return this.api
      .postData<unknown[]>(this.base, this.toCreatePayload(body))
      .pipe(map(items => (items ?? []).map(normalizeMaintenanceDetail)));
  }

  softDelete(id: string | number, fleetId: string): Observable<boolean> {
    const fid = normalizeFleetId(fleetId);
    if (!fid) {
      return throwError(() => new Error('FleetId is required'));
    }

    return this.api.deleteData<boolean>(`${this.base}/SoftDelete`, {
      id: Number(id),
      idfleet: fid,
      Idfleet: fid,
      fleetId: fid,
      FleetId: fid,
    });
  }

  private toCreatePayload(body: MaintenanceDetailCreateRequest): Record<string, unknown> {
    const details = body.details.map(line => ({
      IdSparePartName: line.idSparePartName,
      idSparePartName: line.idSparePartName,
      IdSupplier: line.idSupplier,
      idSupplier: line.idSupplier,
      Price: line.price,
      price: line.price,
      Tax: line.tax,
      tax: line.tax,
      NumberInvoice: line.numberInvoice,
      numberInvoice: line.numberInvoice,
      DateInvoice: line.dateInvoice,
      dateInvoice: line.dateInvoice,
    }));

    return {
      IdMaintenance: body.idMaintenance,
      idMaintenance: body.idMaintenance,
      FleetId: body.fleetId,
      fleetId: body.fleetId,
      Details: details,
      details,
    };
  }
}
