export interface MaintenanceDetail {
  id: string;
  idMaintenance: number;
  idSparePartName: number;
  sparePartName?: string;
  idSupplier: number;
  supplierName?: string;
  price: number;
  tax: number;
  numberInvoice: number;
  dateInvoice: string;
  typeMaintenance: number;
  isAcceptable: boolean;
  fleetId?: string;
  createdAt?: string;
}

export interface MaintenanceDetailLineRequest {
  idSparePartName: number;
  idSupplier: number;
  price: number;
  tax: number;
  numberInvoice: number;
  dateInvoice: string;
}

export interface MaintenanceDetailCreateRequest {
  idMaintenance: number;
  fleetId: string;
  details: MaintenanceDetailLineRequest[];
}
