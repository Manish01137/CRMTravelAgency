/**
 * Checks a traveller's typed answer to a Bot Flow question against the
 * answer type the step expects, and normalises it for the Lead field.
 */

export const ANSWER_TYPES = ['text', 'email', 'phone', 'number', 'date'] as const;
export type AnswerType = (typeof ANSWER_TYPES)[number];

export type ValidationResult = { ok: true; value: string | number | Date } | { ok: false };

/** The answer type a Lead field implies when the step doesn't set one. */
export function defaultAnswerType(leadField: string | null | undefined): AnswerType {
  switch (leadField) {
    case 'email':
      return 'email';
    case 'phone':
      return 'phone';
    case 'travelerCount':
      return 'number';
    case 'travelDate':
      return 'date';
    default:
      return 'text';
  }
}

export const DEFAULT_ERROR_MESSAGES: Record<AnswerType, string> = {
  text: 'Sorry, I didn’t get that — could you type your answer?',
  email: 'That doesn’t look like a valid email address. Please send it again (e.g. name@example.com).',
  phone: 'That doesn’t look like a valid phone number. Please send it again with the country code (e.g. +91 98765 43210).',
  number: 'Please reply with a number (e.g. 4).',
  date: 'Please send the date like 25/12/2026 or 25 Dec.',
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5,
  jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10,
  dec: 11, december: 11,
};

function makeDate(year: number, month: number, day: number): Date | null {
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month, day));
  // Rejects 31/02 etc. (Date would roll it over into March).
  return d.getUTCMonth() === month && d.getUTCDate() === day ? d : null;
}

function expandYear(y: string): number {
  const n = parseInt(y, 10);
  return y.length <= 2 ? 2000 + n : n;
}

/**
 * Parses the dates travellers actually type, day-first (Indian / most of
 * the world): 25/12/2026, 25-12-26, 25.12.2026, 2026-12-25, 25 Dec 2026,
 * Dec 25, 25th December. A date without a year means its next occurrence.
 */
export function parseTravelDate(input: string, now = new Date()): Date | null {
  const s = input.trim().toLowerCase().replace(/(\d)(st|nd|rd|th)\b/g, '$1').replace(/,/g, ' ');
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  const withYear = (month: number, day: number, year?: string): Date | null => {
    if (year) return makeDate(expandYear(year), month, day);
    const thisYear = makeDate(now.getUTCFullYear(), month, day);
    if (thisYear && thisYear.getTime() >= today) return thisYear;
    return makeDate(now.getUTCFullYear() + 1, month, day);
  };

  let m = s.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/); // ISO
  if (m) return makeDate(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));

  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?\b/); // dd/mm[/yy[yy]]
  if (m) return withYear(parseInt(m[2], 10) - 1, parseInt(m[1], 10), m[3]);

  m = s.match(/\b(\d{1,2})\s+([a-z]{3,9})\.?(?:\s+(\d{2}|\d{4}))?\b/); // 25 dec [2026]
  if (m && m[2] in MONTHS) return withYear(MONTHS[m[2]], parseInt(m[1], 10), m[3]);

  m = s.match(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:\s+(\d{4}))?\b/); // dec 25 [2026]
  if (m && m[1] in MONTHS) return withYear(MONTHS[m[1]], parseInt(m[2], 10), m[3]);

  return null;
}

export function validateAnswer(type: AnswerType, raw: unknown, now = new Date()): ValidationResult {
  if (raw instanceof Date) return type === 'date' && !Number.isNaN(raw.getTime()) ? { ok: true, value: raw } : { ok: false };
  if (typeof raw === 'number') {
    if (type === 'number') return Number.isFinite(raw) && raw > 0 ? { ok: true, value: Math.round(raw) } : { ok: false };
    raw = String(raw);
  }
  const text = String(raw ?? '').trim();
  if (!text) return { ok: false };

  switch (type) {
    case 'email': {
      const found = text.match(/[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>().,;]{2,}/)?.[0];
      return found && EMAIL.test(found) ? { ok: true, value: found.toLowerCase() } : { ok: false };
    }
    case 'phone': {
      const candidate = text.match(/\+?[\d\s().-]{7,}/)?.[0] ?? '';
      const digits = candidate.replace(/\D/g, '');
      if (digits.length < 7 || digits.length > 15) return { ok: false };
      return { ok: true, value: candidate.trim().startsWith('+') ? `+${digits}` : digits };
    }
    case 'number': {
      const n = parseInt(text.match(/\d+/)?.[0] ?? '', 10);
      if (Number.isFinite(n) && n > 0) return { ok: true, value: n };
      const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
      const word = Object.keys(words).find((w) => new RegExp(`\\b${w}\\b`, 'i').test(text));
      return word ? { ok: true, value: words[word] } : { ok: false };
    }
    case 'date': {
      const d = parseTravelDate(text, now);
      if (!d) return { ok: false };
      // A travel date well in the past is almost certainly a typo.
      const yesterday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 86_400_000;
      return d.getTime() >= yesterday ? { ok: true, value: d } : { ok: false };
    }
    default:
      return { ok: true, value: text };
  }
}
