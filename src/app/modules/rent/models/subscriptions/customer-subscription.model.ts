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
