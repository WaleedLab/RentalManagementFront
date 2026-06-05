export interface Fleet {
  id: string;
  name: string;
  description?: string;
  fleetCode?: string;
  taxNumber?: string;
  url?: string;
  imageExtension?: string;
  isActive: boolean;
  location?: string;
  contactNumber?: string;
  email?: string;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  deletedBy?: string;
  deletedAt?: string;
  isDeleted?: boolean;
}

export interface FleetUpsertRequest {
  name: string;
  description?: string;
  fleetCode?: string;
  taxNumber?: string;
  location?: string;
  contactNumber?: string;
  email?: string;
  isActive?: boolean;
  image?: File | null;
}

