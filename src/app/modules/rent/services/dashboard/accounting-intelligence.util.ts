import {
  AccountingAlert,
  AccountingSummaryResponse,
} from '../../models/dashboard/accounting-summary.model';
import {
  AccountingInsight,
  FinancialFeedItem,
  FinancialHealthTone,
  FinancialHeroStatus,
} from '../../models/dashboard/accounting-intelligence.model';

export function buildFinancialHeroStatus(summary: AccountingSummaryResponse): FinancialHeroStatus {
  const { kpis, profitTrend } = summary;
  const sparklineValues = profitTrend.map(point => point.value);
  const sparklineLabels = profitTrend.map(point => point.label);

  let growthPercent: number | null = null;
  if (profitTrend.length >= 2) {
    const last = profitTrend[profitTrend.length - 1]?.value ?? 0;
    const prev = profitTrend[profitTrend.length - 2]?.value ?? 0;
    if (Math.abs(prev) > 0.01) {
      growthPercent = ((last - prev) / Math.abs(prev)) * 100;
    }
  }

  const healthTone = resolveHealthTone(summary);
  const healthLabelKey = healthLabelForTone(healthTone);

  let growthLabelKey = 'Stable period';
  const growthLabelParams: Record<string, string | number> = {};
  if (growthPercent != null && Number.isFinite(growthPercent)) {
    if (growthPercent > 3) {
      growthLabelKey = 'Strong growth this period';
      growthLabelParams['percent'] = Math.round(growthPercent);
    } else if (growthPercent < -3) {
      growthLabelKey = 'Profit declined this period';
      growthLabelParams['percent'] = Math.abs(Math.round(growthPercent));
    } else {
      growthLabelKey = 'Stable period';
    }
  }

  return {
    netProfit: kpis.netProfit,
    revenue: kpis.totalRevenue,
    expenses: kpis.totalExpenses,
    growthPercent,
    healthTone,
    healthLabelKey,
    growthLabelKey,
    growthLabelParams,
    sparklineLabels,
    sparklineValues,
  };
}

export function buildAccountingInsights(summary: AccountingSummaryResponse): AccountingInsight[] {
  const insights: AccountingInsight[] = [];
  const { kpis, alerts } = summary;
  const pendingCount = alerts.length;
  const expenseRatio =
    kpis.totalRevenue > 0 ? kpis.totalExpenses / kpis.totalRevenue : 0;

  if (pendingCount > 0) {
    insights.push({
      id: 'pending-entries',
      tone: pendingCount >= 8 ? 'risk' : 'warning',
      icon: '⚠',
      titleKey: 'Pending entries insight title',
      titleParams: { count: pendingCount },
      descriptionKey: 'Pending entries insight body',
    });
  }

  if (expenseRatio >= 0.75 && kpis.totalRevenue > 0) {
    const percent = Math.round(expenseRatio * 100);
    insights.push({
      id: 'high-expenses',
      tone: 'warning',
      icon: '📉',
      titleKey: 'Operating expenses elevated',
      descriptionKey: 'Expenses ratio insight body',
      descriptionParams: { percent },
    });
  }

  if (kpis.netProfit > 0 && kpis.totalRevenue > 0) {
    insights.push({
      id: 'positive-profit',
      tone: 'good',
      icon: '✓',
      titleKey: 'Positive net position',
      descriptionKey: 'Positive profit insight body',
    });
  }

  if (kpis.cashBalanceUnavailable || kpis.bankBalanceUnavailable) {
    insights.push({
      id: 'balances-pending',
      tone: 'info',
      icon: 'ℹ',
      titleKey: 'Balance APIs not connected',
      descriptionKey: 'Balance APIs insight body',
    });
  }

  if (kpis.receivablesUnavailable) {
    insights.push({
      id: 'receivables-pending',
      tone: 'muted',
      icon: '◌',
      titleKey: 'Receivables coming soon',
      descriptionKey: 'Receivables insight body',
    });
  }

  const strongestDay = findStrongestCashFlowDay(summary);
  if (strongestDay) {
    insights.push({
      id: 'strongest-day',
      tone: 'good',
      icon: '◎',
      titleKey: 'Strongest cash day',
      titleParams: { day: strongestDay.label },
      descriptionKey: 'Strongest cash day body',
      descriptionParams: { amount: Math.round(strongestDay.inflow) },
    });
  }

  if (insights.length === 0) {
    insights.push({
      id: 'no-issues',
      tone: 'good',
      icon: '◎',
      titleKey: 'No critical issues detected',
      descriptionKey: 'No critical issues body',
    });
  }

  return insights.slice(0, 5);
}

export function buildFinancialFeed(summary: AccountingSummaryResponse): FinancialFeedItem[] {
  const items: FinancialFeedItem[] = [];

  for (const journal of summary.recentJournals) {
    const isBalanced = journal.isBalanced !== false;
    items.push({
      id: `journal-${journal.journalNumber}-${journal.date}`,
      tone: isBalanced ? 'good' : 'warning',
      icon: isBalanced ? '🟢' : '🟠',
      titleKey: isBalanced ? 'Journal posted' : 'Journal pending balance',
      titleParams: { number: journal.journalNumber },
      subtitleKey: isBalanced ? 'Journal feed balanced' : 'Journal feed unbalanced',
      subtitleParams: {
        debit: Math.round(journal.debit),
        credit: Math.round(journal.credit),
      },
      amount: Math.max(journal.debit, journal.credit),
      date: journal.date,
    });
  }

  for (const alert of summary.alerts.slice(0, 8)) {
    items.push({
      id: `alert-${alert.title}-${alert.description}`,
      tone: mapAlertTone(alert),
      icon: '🔴',
      titleKey: 'Pending entry feed',
      titleParams: { title: alert.title },
      subtitleKey: 'Pending entry feed body',
      subtitleParams: { description: alert.description },
    });
  }

  const todayFlow = summary.cashFlow[summary.cashFlow.length - 1];
  if (todayFlow && (todayFlow.inflow > 0 || todayFlow.outflow > 0)) {
    items.unshift({
      id: `flow-${todayFlow.label}`,
      tone: todayFlow.net >= 0 ? 'info' : 'warning',
      icon: '🔵',
      titleKey: 'Daily cash movement',
      titleParams: { day: todayFlow.label },
      subtitleKey: 'Daily cash movement body',
      subtitleParams: {
        inflow: Math.round(todayFlow.inflow),
        outflow: Math.round(todayFlow.outflow),
      },
    });
  }

  return items.slice(0, 12);
}

export function buildTimelineSummary(summary: AccountingSummaryResponse): {
  postedCount: number;
  pendingCount: number;
  netFlow: number;
} {
  const postedCount = summary.recentJournals.filter(j => j.isBalanced !== false).length;
  const pendingCount = summary.alerts.length;
  const netFlow = summary.cashFlow.reduce((sum, point) => sum + point.net, 0);
  return { postedCount, pendingCount, netFlow };
}

function resolveHealthTone(summary: AccountingSummaryResponse): FinancialHealthTone {
  const { kpis, alerts } = summary;
  if (!kpis.totalRevenue && !kpis.totalExpenses && !summary.recentJournals.length) {
    return 'muted';
  }
  if (kpis.netProfit < 0 || alerts.length >= 12) {
    return 'risk';
  }
  if (alerts.length >= 5 || (kpis.totalRevenue > 0 && kpis.totalExpenses / kpis.totalRevenue > 0.85)) {
    return 'attention';
  }
  if (kpis.netProfit > 0) {
    return 'excellent';
  }
  return 'attention';
}

function healthLabelForTone(tone: FinancialHealthTone): string {
  switch (tone) {
    case 'excellent':
      return 'Health excellent';
    case 'attention':
      return 'Health attention';
    case 'risk':
      return 'Health risk';
    default:
      return 'Health muted';
  }
}

function findStrongestCashFlowDay(
  summary: AccountingSummaryResponse,
): { label: string; inflow: number } | null {
  if (!summary.cashFlow.length) {
    return null;
  }
  return summary.cashFlow.reduce((best, point) =>
    point.inflow > best.inflow ? point : best,
  );
}

function mapAlertTone(alert: AccountingAlert): FinancialFeedItem['tone'] {
  if (alert.type === 'risk') {
    return 'risk';
  }
  if (alert.type === 'warning') {
    return 'warning';
  }
  return 'info';
}
