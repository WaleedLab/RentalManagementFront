export interface Branch {
  id: number; // backend: long
  fleetId: string; // backend: Guid
  nameAr: string;
  nameEn?: string;
  code?: string;
  street?: string;
  neighborHood?: string;
  buldingNumber?: string;
  city?: string;
  contactNumber?: string;
  isActive: boolean;

  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedBy?: string;
  deletedAt?: string;
  isDeleted?: boolean;
}

export interface BranchPaginatedRequest {
  pageNumber: number;
  pageSize: number;
  fleetId?: string;
  search?: string;
  orderByDirection?: string;
  orderBy?: string | number;
}

export interface BranchUpsertRequest {
  id?: number;
  nameAr: string;
  fleetId: string;
  nameEn?: string;
  isActive: boolean;
  code?: string;
  street?: string;
  neighborHood?: string;
  buldingNumber?: string;
  city?: string;
  contactNumber?: string;
}

