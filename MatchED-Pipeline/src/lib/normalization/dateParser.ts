import { parse, isValid, parseISO } from 'date-fns';

const ROLLING_KEYWORDS = ['rolling', 'open', 'ongoing', 'continuous', 'until filled', 'tbd', 'n/a'];

const MONTH_NAMES: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8, sept: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

/**
 * Attempts to parse a date string into a Date object.
 * Handles: ISO dates, "Month DD YYYY", "DD/MM/YYYY", "YYYY-MM-DD",
 * relative keywords like "rolling" or "open" (returns null).
 * Returns null if the string cannot be parsed.
 */
export function parseDate(raw: string | null): Date | null {
  if (!raw) return null;

  const cleaned = raw.trim().toLowerCase();

  // Check for rolling/open keywords — not a real date
  if (ROLLING_KEYWORDS.some((kw) => cleaned.includes(kw))) {
    return null;
  }

  // Try ISO parsing first
  try {
    const isoDate = parseISO(raw.trim());
    if (isValid(isoDate)) return isoDate;
  } catch {
    // continue
  }

  // Try YYYY-MM-DD
  const yyyymmdd = raw.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (yyyymmdd) {
    const d = new Date(parseInt(yyyymmdd[1]), parseInt(yyyymmdd[2]) - 1, parseInt(yyyymmdd[3]));
    if (isValid(d)) return d;
  }

  // Try DD/MM/YYYY
  const ddmmyyyy = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const d = new Date(parseInt(ddmmyyyy[3]), parseInt(ddmmyyyy[2]) - 1, parseInt(ddmmyyyy[1]));
    if (isValid(d)) return d;
  }

  // Try MM/DD/YYYY (common in US)
  const mmddyyyy = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mmddyyyy) {
    const d = new Date(parseInt(mmddyyyy[3]), parseInt(mmddyyyy[1]) - 1, parseInt(mmddyyyy[2]));
    if (isValid(d)) return d;
  }

  // Try "Month DD, YYYY" or "Month DD YYYY"
  const monthDayYear = cleaned.match(/^([a-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (monthDayYear) {
    const monthNum = MONTH_NAMES[monthDayYear[1]];
    if (monthNum !== undefined) {
      const d = new Date(parseInt(monthDayYear[3]), monthNum, parseInt(monthDayYear[2]));
      if (isValid(d)) return d;
    }
  }

  // Try "DD Month YYYY"
  const dayMonthYear = cleaned.match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (dayMonthYear) {
    const monthNum = MONTH_NAMES[dayMonthYear[2]];
    if (monthNum !== undefined) {
      const d = new Date(parseInt(dayMonthYear[3]), monthNum, parseInt(dayMonthYear[1]));
      if (isValid(d)) return d;
    }
  }

  // Try "Month YYYY" (no day — use first of month)
  const monthYear = cleaned.match(/^([a-z]+)\s+(\d{4})$/);
  if (monthYear) {
    const monthNum = MONTH_NAMES[monthYear[1]];
    if (monthNum !== undefined) {
      const d = new Date(parseInt(monthYear[2]), monthNum, 1);
      if (isValid(d)) return d;
    }
  }

  // Try date-fns parse with common formats
  const formats = [
    'MMM dd, yyyy',
    'MMM dd yyyy',
    'MMMM dd, yyyy',
    'MMMM dd yyyy',
    'dd MMM yyyy',
    'dd MMMM yyyy',
    'yyyy/MM/dd',
    'MM-dd-yyyy',
    'dd-MM-yyyy',
  ];

  for (const fmt of formats) {
    try {
      const d = parse(raw.trim(), fmt, new Date());
      if (isValid(d)) return d;
    } catch {
      // continue
    }
  }

  return null;
}
