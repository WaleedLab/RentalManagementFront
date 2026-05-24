import { toDateOnlyInput } from './accounting-queries/accounting-date.utils';

export type DatePresetKey = '7d' | 'month' | 'quarter';

export function resolveDatePreset(preset: DatePresetKey): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date(end);

  switch (preset) {
    case '7d':
      start.setDate(end.getDate() - 6);
      break;
    case 'month':
      start.setDate(1);
      break;
    case 'quarter': {
      const quarterMonth = Math.floor(end.getMonth() / 3) * 3;
      start.setMonth(quarterMonth, 1);
      break;
    }
  }

  return {
    startDate: toDateOnlyInput(start.toISOString()),
    endDate: toDateOnlyInput(end.toISOString()),
  };
}
