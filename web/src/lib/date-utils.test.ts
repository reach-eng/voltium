import { describe, it, expect } from 'vitest';
import {
  formatDateDDMMYYYY,
  formatDateTimeDDMMYYYY,
  formatDateTimeShortDDMMYYYY,
  parseDDMMYYYY,
  isValidDDMMYYYY,
} from './date-utils';

describe('date-utils (DD-MM-YYYY)', () => {
  describe('formatDateDDMMYYYY', () => {
    it('formats a Date as DD-MM-YYYY', () => {
      // Use local time constructor to avoid timezone flakiness
      const d = new Date(2026, 2, 15); // 15 March 2026 local
      expect(formatDateDDMMYYYY(d)).toBe('15-03-2026');
    });

    it('pads single-digit day and month with zeros', () => {
      const d = new Date(2026, 0, 5); // 5 January 2026
      expect(formatDateDDMMYYYY(d)).toBe('05-01-2026');
    });

    it('accepts a string input', () => {
      expect(formatDateDDMMYYYY('2026-03-15T10:00:00Z')).toMatch(
        /^\d{2}-\d{2}-\d{4}$/,
      );
    });

    it('returns empty string for null/undefined/invalid', () => {
      expect(formatDateDDMMYYYY(null)).toBe('');
      expect(formatDateDDMMYYYY(undefined)).toBe('');
      expect(formatDateDDMMYYYY('not-a-date')).toBe('');
    });
  });

  describe('formatDateTimeDDMMYYYY', () => {
    it('formats a Date as DD-MM-YYYY HH:mm:ss', () => {
      const d = new Date(2026, 2, 15, 14, 30, 45);
      expect(formatDateTimeDDMMYYYY(d)).toBe('15-03-2026 14:30:45');
    });

    it('pads all numeric components', () => {
      const d = new Date(2026, 0, 5, 9, 5, 3);
      expect(formatDateTimeDDMMYYYY(d)).toBe('05-01-2026 09:05:03');
    });
  });

  describe('formatDateTimeShortDDMMYYYY', () => {
    it('omits seconds', () => {
      const d = new Date(2026, 2, 15, 14, 30, 45);
      expect(formatDateTimeShortDDMMYYYY(d)).toBe('15-03-2026 14:30');
    });
  });

  describe('parseDDMMYYYY', () => {
    it('parses a valid DD-MM-YYYY string', () => {
      const d = parseDDMMYYYY('15-03-2026');
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
      expect(d!.getMonth()).toBe(2);
      expect(d!.getDate()).toBe(15);
    });

    it('parses an ISO 8601 string as a fallback', () => {
      const d = parseDDMMYYYY('2026-03-15');
      expect(d).not.toBeNull();
      expect(d!.getFullYear()).toBe(2026);
    });

    it('returns null for invalid input', () => {
      expect(parseDDMMYYYY('not-a-date')).toBeNull();
      expect(parseDDMMYYYY('32-01-2026')).toBeNull(); // invalid day
      expect(parseDDMMYYYY('01-13-2026')).toBeNull(); // invalid month
      expect(parseDDMMYYYY('2026-03-15T10:00:00Z')).not.toBeNull(); // full ISO is OK
    });

    it('returns null for empty/null/undefined', () => {
      expect(parseDDMMYYYY('')).toBeNull();
      expect(parseDDMMYYYY(null)).toBeNull();
      expect(parseDDMMYYYY(undefined)).toBeNull();
    });
  });

  describe('isValidDDMMYYYY', () => {
    it('returns true for valid DD-MM-YYYY', () => {
      expect(isValidDDMMYYYY('15-03-2026')).toBe(true);
    });

    it('returns false for invalid input', () => {
      expect(isValidDDMMYYYY('2026-03-15')).toBe(false); // ISO, not DD-MM-YYYY
      expect(isValidDDMMYYYY('not-a-date')).toBe(false);
      expect(isValidDDMMYYYY('')).toBe(false);
    });
  });

  describe('F-23: Timezone support (Asia/Kolkata vs UTC)', () => {
    it('defaults to Asia/Kolkata timezone formatting for ISO UTC timestamps', () => {
      // 10:30:45 UTC is 16:00:45 IST (+05:30)
      const iso = '2026-03-15T10:30:45.000Z';
      expect(formatDateDDMMYYYY(iso)).toBe('15-03-2026');
      expect(formatDateTimeDDMMYYYY(iso)).toBe('15-03-2026 16:00:45');
      expect(formatDateTimeShortDDMMYYYY(iso)).toBe('15-03-2026 16:00');
    });

    it('correctly shifts date across UTC midnight in Asia/Kolkata (+05:30)', () => {
      // 22:30:00 UTC on March 15 is 04:00:00 IST on March 16
      const iso = '2026-03-15T22:30:00.000Z';
      expect(formatDateDDMMYYYY(iso)).toBe('16-03-2026');
      expect(formatDateTimeDDMMYYYY(iso)).toBe('16-03-2026 04:00:00');
      expect(formatDateTimeShortDDMMYYYY(iso)).toBe('16-03-2026 04:00');
    });

    it('supports explicit UTC timezone override as string', () => {
      const iso = '2026-03-15T22:30:00.000Z';
      expect(formatDateDDMMYYYY(iso, 'UTC')).toBe('15-03-2026');
      expect(formatDateTimeDDMMYYYY(iso, 'UTC')).toBe('15-03-2026 22:30:00');
      expect(formatDateTimeShortDDMMYYYY(iso, 'UTC')).toBe('15-03-2026 22:30');
    });

    it('supports explicit timezone override via options object', () => {
      const iso = '2026-03-15T22:30:00.000Z';
      expect(formatDateDDMMYYYY(iso, { timeZone: 'UTC' })).toBe('15-03-2026');
      expect(formatDateTimeDDMMYYYY(iso, { timeZone: 'UTC' })).toBe('15-03-2026 22:30:00');
    });

    it('gracefully falls back to default timezone on invalid timezone identifier', () => {
      const iso = '2026-03-15T10:30:45.000Z';
      expect(formatDateDDMMYYYY(iso, 'Invalid/Timezone_123')).toBe('15-03-2026');
      expect(formatDateTimeDDMMYYYY(iso, 'Invalid/Timezone_123')).toBe('15-03-2026 16:00:45');
    });
  });
});
