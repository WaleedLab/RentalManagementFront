export interface SparePart {
  id: string;
  fleetId: string;
  name: string;
  number: number;
  description?: string;
}

export type SparePartOrderBy = number;

export interface SparePartFilters {
  fleetId?: string | null;
  pageNumber: number;
  pageSize: number;
  search?: string;
  orderBy?: SparePartOrderBy;
  orderByDirection?: 'ASC' | 'DESC';
}

export interface SparePartUpsertRequest {
  id?: string;
  fleetId: string;
  name: string;
  number: number;
  description?: string | null;
}
