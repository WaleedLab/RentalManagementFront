export interface CountingEntry {
  id: string;
  countingNumber?: number;
  countingLevel?: number;
  nameAr?: string;
  nameEn?: string;
  balannce?: number;
}

export interface CreateCountingEntryRequest {
  countingNumber: number;
  countingMain: number;
  countingType: number;
  reportNumber: number;
  countingLevel: number;
  balannce: number;
  nameAr: string;
  nameEn?: string;
  fleetId: string;
}

