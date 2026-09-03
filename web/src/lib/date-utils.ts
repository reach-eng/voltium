/**
 * Date utilities for DD-MM-YYYY formatting.
 *
 * The Voltium app standardizes on DD-MM-YYYY (day-month-year) for all
 * user-facing dates, as the primary user base is in India. This module
 * provides a single source of truth for formatting, parsing, and
 * validation.
 *
 * Conventions:
 *   - Display dates: always DD-MM-YYYY (e.g., 15-03-2026)
 *   - Display datetimes: DD-MM-YYYY HH:mm:ss (e.g., 15-03-2026 14:30:00)
 *   - Internal storage: ISO 8601 UTC (handled by Prisma + TIMESTAMPTZ)
 *   - API contracts: ISO 8601 UTC for machine-readable fields; DD-MM-YYYY
 *     for human-readable display fields
 *   - API input: accept both DD-MM-YYYY and ISO 8601 (parseDDMMYYYY
 *     returns null for invalid input; callers should also try
 *     `new Date(str)` as a fallback for ISO 8601)
 *
 * Migration plan:
 *   1. Replace all `toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })`
 *      calls with `formatDateDDMMYYYY()`
 *   2. Replace all `toLocaleString('en-IN')` calls with `formatDateTimeDDMMYYYY()`
 *   3. Replace all `toISOString().split('T')[0]` (used for filename dates)
 *      with `formatDateDDMMYYYY()` so filenames are consistent
 *   4. Update Zod date input validators to accept DD-MM-YYYY
 *   5. Update API response formatters
 */

export const DEFAULT_TIMEZONE = 'Asia/Kolkata';

export type TimeZoneInput = string | { timeZone?: string };

const dtfCache = new Map<string, Intl.DateTimeFormat>();

function getFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = dtfCache.get(timeZone);
  if (!formatter) {
    try {
      formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    } catch {
      formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: DEFAULT_TIMEZONE,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }
    dtfCache.set(timeZone, formatter);
  }
  return formatter;
}

function resolveTimeZone(timeZoneOrOptions?: TimeZoneInput): string {
  if (!timeZoneOrOptions) return DEFAULT_TIMEZONE;
  if (typeof timeZoneOrOptions === 'string') return timeZoneOrOptions;
  return timeZoneOrOptions.timeZone || DEFAULT_TIMEZONE;
}

function getZonedParts(d: Date, timeZone: string) {
  const formatter = getFormatter(timeZone);
  const parts = formatter.formatToParts(d);
  let day = '';
  let month = '';
  let year = '';
  let hour = '';
  let minute = '';
  let second = '';

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    switch (part.type) {
      case 'day':
        day = part.value;
        break;
      case 'month':
        month = part.value;
        break;
      case 'year':
        year = part.value;
        break;
      case 'hour':
        hour = part.value === '24' ? '00' : part.value;
        break;
      case 'minute':
        minute = part.value;
        break;
      case 'second':
        second = part.value;
        break;
    }
  }

  return { day, month, year, hour, minute, second };
}

/**
 * Format a Date as DD-MM-YYYY in the specified timezone (defaults to Asia/Kolkata).
 *
 * @example formatDateDDMMYYYY(new Date('2026-03-15T10:00:00Z')) // → '15-03-2026'
 * @example formatDateDDMMYYYY(new Date('2026-03-15T22:30:00Z'), 'Asia/Kolkata') // → '16-03-2026'
 * @example formatDateDDMMYYYY(new Date('2026-03-15T22:30:00Z'), 'UTC') // → '15-03-2026'
 */
export function formatDateDDMMYYYY(
  date: Date | string | null | undefined,
  timeZoneOrOptions?: TimeZoneInput
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const tz = resolveTimeZone(timeZoneOrOptions);
  const { day, month, year } = getZonedParts(d, tz);
  return `${day}-${month}-${year}`;
}

/**
 * Format a Date as DD-MM-YYYY HH:mm:ss in the specified timezone (defaults to Asia/Kolkata).
 *
 * @example formatDateTimeDDMMYYYY(new Date('2026-03-15T10:30:45Z')) // → '15-03-2026 16:00:45' (in Asia/Kolkata)
 * @example formatDateTimeDDMMYYYY(new Date('2026-03-15T10:30:45Z'), 'UTC') // → '15-03-2026 10:30:45'
 */
export function formatDateTimeDDMMYYYY(
  date: Date | string | null | undefined,
  timeZoneOrOptions?: TimeZoneInput
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const tz = resolveTimeZone(timeZoneOrOptions);
  const { day, month, year, hour, minute, second } = getZonedParts(d, tz);
  return `${day}-${month}-${year} ${hour}:${minute}:${second}`;
}

/**
 * Format a Date as DD-MM-YYYY HH:mm (no seconds) in the specified timezone (defaults to Asia/Kolkata).
 */
export function formatDateTimeShortDDMMYYYY(
  date: Date | string | null | undefined,
  timeZoneOrOptions?: TimeZoneInput
): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return '';
  const tz = resolveTimeZone(timeZoneOrOptions);
  const { day, month, year, hour, minute } = getZonedParts(d, tz);
  return `${day}-${month}-${year} ${hour}:${minute}`;
}

/**
 * Parse a DD-MM-YYYY string into a Date. Returns null for invalid input.
 * Also accepts ISO 8601 (YYYY-MM-DD) as a fallback.
 *
 * @example parseDDMMYYYY('15-03-2026') // → Date object
 * @example parseDDMMYYYY('2026-03-15') // → Date object (ISO fallback)
 * @example parseDDMMYYYY('invalid')    // → null
 */
export function parseDDMMYYYY(input: string | null | undefined): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // DD-MM-YYYY format
  const ddmmyyyy = /^(\d{2})-(\d{2})-(\d{4})$/.exec(trimmed);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const d = new Date(year, month, day);
    if (
      d.getFullYear() === year &&
      d.getMonth() === month &&
      d.getDate() === day
    ) {
      return d;
    }
    return null;
  }

  // ISO 8601 (YYYY-MM-DD or full ISO datetime) fallback
  const iso = new Date(trimmed);
  return Number.isNaN(iso.getTime()) ? null : iso;
}

/**
 * Check whether a string is a valid DD-MM-YYYY date. Strict — does not
 * accept ISO 8601 as a fallback. Use `parseDDMMYYYY` if you need to
 * accept both formats.
 */
export function isValidDDMMYYYY(input: string | null | undefined): boolean {
  if (!input) return false;
  return DDMMYYYY_REGEX.test(input.trim()) && parseDDMMYYYY(input) !== null;
}

/**
 * Zod-compatible date validator that accepts DD-MM-YYYY.
 * Use as: `z.string().refine(isValidDDMMYYYY, 'Date must be in DD-MM-YYYY format')`
 */
export const DDMMYYYY_REGEX = /^\d{2}-\d{2}-\d{4}$/;
