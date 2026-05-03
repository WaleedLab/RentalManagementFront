import countries, { type LocaleData, registerLocale } from 'i18n-iso-countries';

import arLocale from 'i18n-iso-countries/langs/ar.json';
import enLocale from 'i18n-iso-countries/langs/en.json';

registerLocale(arLocale as LocaleData);
registerLocale(enLocale as LocaleData);

/**
 * UN M49 Asia (incl. Western Asia) + HK/MO/TW and common Asian territories (CX, CC, IO).
 * Mutually exclusive with {@link ALPHA2_AFRICA}.
 */
const ALPHA2_ASIA = new Set<string>([
  'AF',
  'AM',
  'AZ',
  'BH',
  'BD',
  'BT',
  'BN',
  'KH',
  'CN',
  'CY',
  'GE',
  'HK',
  'IN',
  'ID',
  'IR',
  'IQ',
  'IL',
  'JP',
  'JO',
  'KZ',
  'KP',
  'KR',
  'KW',
  'KG',
  'LA',
  'LB',
  'MO',
  'MY',
  'MV',
  'MN',
  'MM',
  'NP',
  'OM',
  'PK',
  'PS',
  'PH',
  'QA',
  'SA',
  'SG',
  'LK',
  'SY',
  'TW',
  'TJ',
  'TH',
  'TL',
  'TM',
  'TR',
  'AE',
  'UZ',
  'VN',
  'YE',
  'CX',
  'CC',
  'IO',
]);

/** UN M49 Africa + EH, RE, YT. Mutually exclusive with {@link ALPHA2_ASIA}. */
const ALPHA2_AFRICA = new Set<string>([
  'DZ',
  'AO',
  'BJ',
  'BW',
  'BF',
  'BI',
  'CV',
  'CM',
  'CF',
  'TD',
  'KM',
  'CG',
  'CD',
  'CI',
  'DJ',
  'EG',
  'GQ',
  'ER',
  'SZ',
  'ET',
  'GA',
  'GM',
  'GH',
  'GN',
  'GW',
  'KE',
  'LS',
  'LR',
  'LY',
  'MG',
  'MW',
  'ML',
  'MR',
  'MU',
  'MA',
  'MZ',
  'NA',
  'NE',
  'NG',
  'RW',
  'ST',
  'SN',
  'SC',
  'SL',
  'SO',
  'ZA',
  'SS',
  'SD',
  'TZ',
  'TG',
  'TN',
  'UG',
  'ZM',
  'ZW',
  'EH',
  'RE',
  'YT',
]);

type Region = 'asia' | 'africa' | 'other';

export interface BookingNationalitySelectLabels {
  /** ngx-translate key or plain text for the empty option */
  placeholder: string;
  asia: string;
  africa: string;
  other: string;
}

export interface BookingNationalityRow {
  readonly code: string;
  readonly region: Region;
  readonly ar: string;
  readonly en: string;
  /** Value stored on the booking / API (official Arabic, disambiguated when needed). */
  readonly canonicalValue: string;
}

export interface BookingNationalitySuggestion {
  readonly canonicalValue: string;
  readonly label: string;
}

/**
 * Loose Arabic normalization for matching user typing to official country names
 * (hamza / alef variants, ta marbuta, diacritics, tatweel, etc.).
 */
export function normalizeArabicLoose(input: string): string {
  let s = input.normalize('NFKC');
  // Tatweel + Arabic diacritics (incl. shadda, sukun, harakat)
  s = s.replace(/[\u0640\u064B-\u065F\u0670]/g, '');
  // Alef / hamza variants → ا
  s = s.replace(/[\u0622\u0623\u0625\u0671]/g, '\u0627');
  // Standalone hamza (often omitted in typing)
  s = s.replace(/\u0621/g, '');
  // Ta marbuta → ه
  s = s.replace(/\u0629/g, '\u0647');
  // Alef maksura → ي
  s = s.replace(/\u0649/g, '\u064A');
  // Waw / yeh with hamza → bare letter (e.g.ؤ→و، ئ→ي)
  s = s.replace(/\u0624/g, '\u0648');
  s = s.replace(/\u0626/g, '\u064A');
  s = s.replace(/\s+/g, ' ').trim();
  return s.toLowerCase();
}

function regionTitle(row: BookingNationalityRow, labels: Pick<BookingNationalitySelectLabels, 'asia' | 'africa' | 'other'>): string {
  if (row.region === 'asia') {
    return labels.asia;
  }
  if (row.region === 'africa') {
    return labels.africa;
  }
  return labels.other;
}

let nationalityRowsCache: BookingNationalityRow[] | null = null;

function buildNationalityRows(): BookingNationalityRow[] {
  type Tmp = { region: Region; code: string; ar: string; en: string };

  const tmp: Tmp[] = [];
  for (const code of Object.keys(countries.getAlpha2Codes())) {
    const ar = countries.getName(code, 'ar') ?? countries.getName(code, 'en') ?? code;
    const en = countries.getName(code, 'en') ?? code;
    let region: Region = 'other';
    if (ALPHA2_ASIA.has(code)) {
      region = 'asia';
    } else if (ALPHA2_AFRICA.has(code)) {
      region = 'africa';
    }
    tmp.push({ region, code, ar, en });
  }

  const arCounts = new Map<string, number>();
  for (const row of tmp) {
    arCounts.set(row.ar, (arCounts.get(row.ar) ?? 0) + 1);
  }

  const canonical = (row: Tmp): string =>
    (arCounts.get(row.ar) ?? 0) > 1 ? `${row.ar} (${row.en})` : row.ar;

  return tmp.map(row => ({
    code: row.code,
    region: row.region,
    ar: row.ar,
    en: row.en,
    canonicalValue: canonical(row),
  }));
}

export function getBookingNationalityRows(): BookingNationalityRow[] {
  if (!nationalityRowsCache) {
    nationalityRowsCache = buildNationalityRows();
  }
  return nationalityRowsCache;
}

/**
 * Match typed nationality to known countries (Arabic + English), tolerant to common Arabic spelling variants.
 */
export function searchBookingNationalities(
  query: string,
  labels: Pick<BookingNationalitySelectLabels, 'asia' | 'africa' | 'other'>,
  limit = 12,
): BookingNationalitySuggestion[] {
  const raw = query.trim();
  if (!raw) {
    return [];
  }

  const nq = normalizeArabicLoose(raw);
  const qen = raw.toLowerCase();

  const rows = getBookingNationalityRows();
  const scored: Array<{ row: BookingNationalityRow; score: number }> = [];

  for (const row of rows) {
    const nAr = normalizeArabicLoose(row.ar);
    const nCanon = normalizeArabicLoose(row.canonicalValue);
    const enLow = row.en.toLowerCase();

    let score = 0;
    if (enLow.includes(qen)) {
      score += 40;
      if (enLow.startsWith(qen)) {
        score += 30;
      }
    }
    if (nq) {
      if (nAr === nq || nCanon === nq) {
        score += 220;
      } else if (nAr.startsWith(nq) || nCanon.startsWith(nq)) {
        score += 120;
      } else if (nAr.includes(nq) || nCanon.includes(nq)) {
        score += 80;
      }
      // Match typed fragment inside English name after normalizing (rare)
      const nEn = normalizeArabicLoose(row.en);
      if (nEn.includes(nq)) {
        score += 25;
      }
    }

    if (score > 0) {
      scored.push({ row, score });
    }
  }

  scored.sort((a, b) => b.score - a.score || a.row.ar.localeCompare(b.row.ar, 'ar'));

  return scored.slice(0, limit).map(({ row }) => ({
    canonicalValue: row.canonicalValue,
    label: `[${regionTitle(row, labels)}] ${row.ar} — ${row.en}`,
  }));
}
