export type FinancialHealthTone = 'excellent' | 'attention' | 'risk' | 'muted';
export type InsightTone = 'good' | 'warning' | 'risk' | 'info' | 'muted';

export interface AccountingInsight {
  id: string;
  tone: InsightTone;
  icon: string;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  descriptionKey: string;
  descriptionParams?: Record<string, string | number>;
}

export interface FinancialFeedItem {
  id: string;
  tone: 'good' | 'warning' | 'info' | 'risk';
  icon: string;
  titleKey: string;
  titleParams?: Record<string, string | number>;
  subtitleKey: string;
  subtitleParams?: Record<string, string | number>;
  amount?: number;
  date?: string;
}

export interface FinancialHeroStatus {
  netProfit: number;
  revenue: number;
  expenses: number;
  growthPercent: number | null;
  healthTone: FinancialHealthTone;
  healthLabelKey: string;
  growthLabelKey: string;
  growthLabelParams?: Record<string, string | number>;
  sparklineLabels: string[];
  sparklineValues: number[];
}

export type AccountingSectionKey = 'filters' | 'hero' | 'trends' | 'activity';
export type AccountingSectionState = 'idle' | 'loading' | 'ready' | 'error';
