import { describe, it, expect } from 'vitest';
import { parsePositiveInt } from '@/lib/api-utils';

// PR-4b (2026-08-06 fix-plan; 13th audit P0-6): `?page=abc` used to flow
// `Math.max(1, parseInt('abc'))` → NaN into Prisma skip/take. This gate
// locks the helper that all paginated routes now route through.
describe('parsePositiveInt', () => {
  it('parses a normal positive integer', () => {
    expect(parsePositiveInt('3', 1)).toBe(3);
    expect(parsePositiveInt('100', 1)).toBe(100);
  });

  it('falls back on NaN garbage (the P0-6 case)', () => {
    expect(parsePositiveInt('abc', 1)).toBe(1);
    expect(parsePositiveInt('12abc', 1)).toBe(12); // parseInt prefix parse
    expect(parsePositiveInt('Infinity', 1)).toBe(1); // Number.isFinite rejects
    expect(parsePositiveInt('1e5', 1)).toBe(1);
  });

  it('falls back on null / empty / undefined-ish input', () => {
    expect(parsePositiveInt(null, 1)).toBe(1);
    expect(parsePositiveInt('', 1)).toBe(1);
    expect(parsePositiveInt('   ', 1)).toBe(1);
  });

  it('falls back on zero and negatives (page/limit of 0 is meaningless)', () => {
    expect(parsePositiveInt('0', 1)).toBe(1);
    expect(parsePositiveInt('-5', 1)).toBe(1);
  });

  it('clamps to max when provided', () => {
    expect(parsePositiveInt('500', 20, 100)).toBe(100);
    expect(parsePositiveInt('10', 20, 100)).toBe(10);
    expect(parsePositiveInt('abc', 20, 100)).toBe(20);
  });

  it('never returns NaN or a non-finite value', () => {
    for (const raw of ['abc', '-1', '0', '1e999', 'Infinity', '-Infinity', null, '']) {
      const out = parsePositiveInt(raw, 1);
      expect(Number.isFinite(out)).toBe(true);
      expect(out).toBeGreaterThanOrEqual(1);
    }
  });
});
