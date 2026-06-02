export interface Supplier {
  id: string;
  fleetId: string;
  supplierName: string;
  phone: string;
  phone2?: string;
  address?: string;
  email?: string;
  taxRecord?: string;
  accountNumber?: string;
}

export type SupplierOrderBy = number;

export interface SupplierFilters {
  fleetId?: string | null;
  pageNumber: number;
  pageSize: number;
  search?: string;
  orderBy?: SupplierOrderBy;
  orderByDirection?: 'ASC' | 'DESC';
}

export interface SupplierUpsertRequest {
  id?: string;
  fleetId: string;
  supplierName: string;
  phone: string;
  phone2?: string | null;
  address?: string | null;
  email?: string | null;
  taxRecord?: string | null;
  accountNumber?: string | null;
}
