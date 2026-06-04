export interface SaudiPlateDisplay {
  arabicLetters: string;
  arabicNumbers: string;
  englishLetters: string;
  englishNumbers: string;
}

const ARABIC_INDIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

const ARABIC_LETTER_TO_LATIN: Record<string, string> = {
  أ: 'A',
  ا: 'A',
  ب: 'B',
  ح: 'J',
  د: 'D',
  ر: 'R',
  س: 'S',
  ص: 'X',
  ط: 'T',
  ع: 'E',
  ق: 'G',
  ك: 'K',
  ل: 'L',
  م: 'Z',
  ن: 'N',
  ه: 'H',
  و: 'U',
  ى: 'Y',
  ي: 'Y',
};

const EMPTY = '—';

function toArabicIndicDigits(value: string): string {
  return value.replace(/\d/g, digit => ARABIC_INDIC_DIGITS[Number(digit)] ?? digit);
}

function normalizeSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function mapArabicLettersToLatin(letters: string): string {
  const chunks = normalizeSpaces(letters).split(' ').filter(Boolean);
  if (!chunks.length) {
    return '';
  }

  return chunks
    .map(chunk =>
      [...chunk]
        .map(char => ARABIC_LETTER_TO_LATIN[char] ?? '')
        .join('')
        .trim(),
    )
    .filter(Boolean)
    .join(' ');
}

export function parseSaudiPlateDisplay(plateNumber: string): SaudiPlateDisplay {
  const trimmed = normalizeSpaces(plateNumber ?? '');
  if (!trimmed) {
    return {
      arabicLetters: EMPTY,
      arabicNumbers: EMPTY,
      englishLetters: EMPTY,
      englishNumbers: EMPTY,
    };
  }

  const arabicLetterMatches = trimmed.match(/[\u0600-\u06FF]+/g) ?? [];
  const latinLetterMatches = trimmed.match(/[A-Za-z]+/g) ?? [];
  const numberMatches = trimmed.match(/\d+/g) ?? [];

  const arabicLetters = normalizeSpaces(arabicLetterMatches.join(' ')) || EMPTY;
  const latinLetters = normalizeSpaces(latinLetterMatches.join(' ').toUpperCase());
  const numbers = numberMatches.join('');

  const arabicNumbers = numbers ? toArabicIndicDigits(numbers) : EMPTY;
  const englishNumbers = numbers || EMPTY;

  let englishLetters = latinLetters;
  if (!englishLetters && arabicLetters !== EMPTY) {
    englishLetters = mapArabicLettersToLatin(arabicLetters) || EMPTY;
  }

  if (arabicLetters === EMPTY && latinLetters) {
    return {
      arabicLetters: latinLetters,
      arabicNumbers,
      englishLetters: latinLetters,
      englishNumbers,
    };
  }

  return {
    arabicLetters,
    arabicNumbers,
    englishLetters: englishLetters || EMPTY,
    englishNumbers,
  };
}
