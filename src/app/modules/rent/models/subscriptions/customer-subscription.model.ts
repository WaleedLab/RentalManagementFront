export interface CustomerSubscription {
  id: number;
  nameAr: string;
  nameEn?: string;
  description?: string;
  discount: number;
  isOld: boolean;
  subscriptionApprovedAfter: number;
  fleetId?: string;
}

export interface CustomerSubscriptionUpsertRequest {
  id?: number;
  nameAr: string;
  nameEn?: string;
  description?: string;
  discount: number;
  isOld: boolean;
  subscriptionApprovedAfter: number;
  fleetId?: string;
}

export interface CustomerSubscriptionPaginatedRequest {
  fleetId?: string | null;
  pageNumber: number;
  pageSize: number;
  search?: string;
  orderByDirection?: 'ASC' | 'DESC';
  orderBy?: string;
}
