export interface InsuranceCompany {
  id: string;
  fleetId: string;
  name: string;
  address?: string;
  phoneNumber?: string;
}

export type InsuranceCompanyOrderBy = number;

export interface InsuranceCompanyFilters {
  fleetId?: string | null;
  pageNumber: number;
  pageSize: number;
  search?: string;
  orderBy?: InsuranceCompanyOrderBy;
  orderByDirection?: 'ASC' | 'DESC';
}

export interface InsuranceCompanyUpsertRequest {
  id?: string;
  fleetId: string;
  name: string;
  address?: string | null;
  phoneNumber?: string | null;
}
