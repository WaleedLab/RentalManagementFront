import { TranslateService } from '@ngx-translate/core';

export function financeLocale(translate: TranslateService): string {
  return translate.currentLang?.startsWith('ar') ? 'ar-SA' : 'en-US';
}

export function formatFinanceDate(value: unknown, translate: TranslateService): string {
  if (!value) {
    return '-';
  }

  const parsed = new Date(String(value));
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat(financeLocale(translate), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function formatFinanceNumber(value: unknown, translate: TranslateService): string {
  if (value === undefined || value === null || value === '') {
    return '-';
  }

  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return String(value);
  }

  return new Intl.NumberFormat(financeLocale(translate)).format(numeric);
}

