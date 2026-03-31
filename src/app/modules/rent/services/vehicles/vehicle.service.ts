import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { PaginatedAggregatorResponse } from '../../../../core/interfaces';
import { BaseRequestOptions } from '../../../../shared/services/base/base.service';
import { BaseService } from '../../../../shared/services/base/base.service';
import { Vehicle, VehicleFilters, VehicleUpsertRequest } from '../../models';
import { normalizePaginatedResponse } from '../../../../shared/utils/paginated-response.normalizer';
import { normalizeVehicle } from '../../models/vehicles/vehicle.normalizer';
import { appendFormDataValue } from '../../../../shared/utils/form-data.utils';

@Injectable({
  providedIn: 'root',
})
export class VehicleService {
  private api = inject(BaseService);
  private readonly base = 'Vehicle';

  getPaginated(params: VehicleFilters, options?: BaseRequestOptions): Observable<PaginatedAggregatorResponse<Vehicle>> {
    return this.api.getData<unknown>(`${this.base}/Paginated`, {
      FleetId: params.fleetId,
      Fleetid: params.fleetId,
      fleetId: params.fleetId,
      fleetid: params.fleetId,
      BranchId: params.branchId ?? undefined,
      branchId: params.branchId ?? undefined,
      BRANCHID: params.branchId ?? undefined,
      status: params.status || undefined,
      Search: params.search,
      PageNumber: params.pageNumber,
      PageSize: params.pageSize,
      search: params.search,
      pageNumber: params.pageNumber,
      pageSize: params.pageSize,
    }, options).pipe(map(response => normalizePaginatedResponse(response, normalizeVehicle)));
  }

  getById(id: string, fleetId: string): Observable<Vehicle> {
    return this.api.getData<unknown>(`${this.base}/${id}/${fleetId}`).pipe(map(normalizeVehicle));
  }

  create(body: VehicleUpsertRequest): Observable<unknown> {
    return this.api.postData(this.base, this.toFormData(body));
  }

  update(body: VehicleUpsertRequest): Observable<unknown> {
    return this.api.putData(`${this.base}/${body.id}`, this.toFormData(body));
  }

  private toFormData(body: VehicleUpsertRequest): FormData {
    const formData = new FormData();
    appendFormDataValue(formData, 'Color', body.color);
    appendFormDataValue(formData, 'InsuranceNumber', body.insuranceNumber);
    appendFormDataValue(formData, 'InsuranceType', body.insuranceType);
    appendFormDataValue(formData, 'InsuranceExpires', body.insuranceExpires);
    appendFormDataValue(formData, 'LicenseExpirationDate', body.licenseExpirationDate);
    appendFormDataValue(formData, 'InsurancePolicyNumber', body.insurancePolicyNumber);
    appendFormDataValue(formData, 'OperatinCard', body.operatinCard);
    appendFormDataValue(formData, 'ValidityCarRegistration', body.validityCarRegistration);
    appendFormDataValue(formData, 'FleetId', body.fleetId);
    appendFormDataValue(formData, 'BranchId', body.branchId);
    appendFormDataValue(formData, 'VIN', body.vin);
    appendFormDataValue(formData, 'YearMake', body.yearMake);
    appendFormDataValue(formData, 'IdCategoryVehicle', body.idCategoryVehicle);
    appendFormDataValue(formData, 'Engine', body.engine);
    appendFormDataValue(formData, 'SerialNumber', body.serialNumber);
    appendFormDataValue(formData, 'PlateNumber', body.plateNumber);
    appendFormDataValue(formData, 'CountKm', body.countKm);
    appendFormDataValue(formData, 'CapacitOil', body.capacitOil);
    appendFormDataValue(formData, 'Image', body.image);
    return formData;
  }
}



