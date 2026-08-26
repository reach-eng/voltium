/**
 * 9.5+ Hardening §9 (T-9P0-6): canonical money model invariants.
 *
 * The `web/src/lib/money.ts` module is the only place that converts
 * between paise (integer, internal) and rupees (decimal, API). These
 * tests pin its contract so a refactor cannot silently break the
 * money round-trip.
 *
 * Invariants pinned:
 *   1. Round-trip: paise -> rupees -> paise preserves the value.
 *   2. Common rupee values land on the expected paise integer.
 *   3. Boundary values (0, 1, 99, 100, MAX_SAFE_INTEGER) are exact.
 *   4. Floating-point error inputs (0.1 + 0.2) round correctly.
 *   5. addPaise / subPaise are pure integer math.
 *   6. sumPaise returns 0 for an empty list.
 *   7. formatRupeesFromPaise produces "₹X.YY".
 *
 * The DB CHECK constraints + scattered-conversion sweep live in
 * separate commits. This file is the unit-level contract test.
 */
import { describe, it, expect } from 'vitest';
import {
  rupeesToPaise,
  paiseToRupees,
  addPaise,
  subPaise,
  sumPaise,
  formatRupeesFromPaise,
  asPaise,
  asRupees,
} from '@/lib/money';

describe('money.ts (9.5+ T-9P0-6)', () => {
  describe('rupeesToPaise / paiseToRupees round-trip', () => {
    it('preserves the integer paise value', () => {
      expect(rupeesToPaise(125.55)).toBe(12555);
      expect(paiseToRupees(12555 as any)).toBe(125.55);
    });

    it('handles 0 paise', () => {
      expect(rupeesToPaise(0)).toBe(0);
      expect(paiseToRupees(0 as any)).toBe(0);
    });

    it('handles 1 paise (smallest representable amount)', () => {
      expect(rupeesToPaise(0.01)).toBe(1);
      expect(paiseToRupees(1 as any)).toBe(0.01);
    });

    it('handles 99 paise (just under ₹1 — does NOT round to ₹1)', () => {
      expect(rupeesToPaise(0.99)).toBe(99);
      expect(paiseToRupees(99 as any)).toBe(0.99);
    });

    it('handles exactly ₹1.00', () => {
      expect(rupeesToPaise(1)).toBe(100);
      expect(paiseToRupees(100 as any)).toBe(1);
    });

    it('handles common rupee values', () => {
      expect(rupeesToPaise(49.95)).toBe(4995);
      expect(rupeesToPaise(49.99)).toBe(4999);
      expect(rupeesToPaise(50)).toBe(5000);
      expect(rupeesToPaise(100000)).toBe(10_000_000);
    });

    it('handles the IEEE-754 0.1 + 0.2 trap', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754. Math.round
      // must still produce 30 paise.
      const sum = 0.1 + 0.2;
      expect(rupeesToPaise(sum)).toBe(30);
    });

    it('handles MAX_SAFE_INTEGER paise (no overflow)', () => {
      const paise = Number.MAX_SAFE_INTEGER;
      const rupees = paiseToRupees(paise as any);
      expect(rupeesToPaise(rupees)).toBe(paise);
    });
  });

  describe('addPaise / subPaise', () => {
    it('addPaise is pure integer math', () => {
      expect(addPaise(asPaise(100), asPaise(250))).toBe(350);
      expect(addPaise(asPaise(0), asPaise(0))).toBe(0);
    });

    it('subPaise is pure integer math', () => {
      expect(subPaise(asPaise(500), asPaise(150))).toBe(350);
      expect(subPaise(asPaise(100), asPaise(100))).toBe(0);
    });

    it('subPaise can produce negatives (caller is responsible for validation)', () => {
      // The money module does not enforce non-negative results; the
      // ledger service does. Pin that the math at least runs.
      expect(subPaise(asPaise(10), asPaise(50))).toBe(-40);
    });
  });

  describe('sumPaise', () => {
    it('returns 0 for an empty list', () => {
      expect(sumPaise([])).toBe(0);
    });

    it('sums a list of paise values', () => {
      expect(sumPaise([100, 200, 300])).toBe(600);
      expect(sumPaise([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(55);
    });

    it('sumPaise of a single value equals the value', () => {
      expect(sumPaise([42])).toBe(42);
    });
  });

  describe('formatRupeesFromPaise', () => {
    it('formats 0 paise as ₹0.00', () => {
      expect(formatRupeesFromPaise(0)).toBe('₹0.00');
    });

    it('formats 1 paise as ₹0.01', () => {
      expect(formatRupeesFromPaise(1)).toBe('₹0.01');
    });

    it('formats 5000 paise as ₹50.00', () => {
      expect(formatRupeesFromPaise(5000)).toBe('₹50.00');
    });

    it('formats 12555 paise as ₹125.55', () => {
      expect(formatRupeesFromPaise(12555)).toBe('₹125.55');
    });

    it('formats 10,000,000 paise as ₹100000.00 (no Indian grouping)', () => {
      // Per money.ts: the Flutter client applies Indian locale
      // formatting. The server-side helper stays simple.
      expect(formatRupeesFromPaise(10_000_000)).toBe('₹100000.00');
    });
  });

  describe('asPaise / asRupees trust-boundary casts', () => {
    it('asPaise returns the same number with the brand', () => {
      const v = asPaise(123);
      expect(v).toBe(123);
    });

    it('asRupees returns the same number with the brand', () => {
      const v = asRupees(1.23);
      expect(v).toBe(1.23);
    });
  });
});
