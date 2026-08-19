/**
 * Boundary-value tests for paise ↔ rupee conversion.
 *
 * TEST-STRATEGY-AUDIT T-P2-5 (2026-08-08): the existing money tests
 * cover the happy path (e.g. `transaction.repository.test.ts` tests
 * `5000 paise = 50 rupees`). They don't cover the edge cases at
 * the conversion boundary:
 *   - paise = 0 (empty wallet, free transaction)
 *   - paise = 1 (the smallest representable amount)
 *   - paise = 99 (just under ₹1 — should NOT round to ₹1)
 *   - paise = 100 (exactly ₹1)
 *   - paise = MAX_SAFE_INTEGER (₹90 trillion — would any flow silently overflow?)
 *   - rupees with a fractional .5 (rounds up or down per `Math.round`?)
 *   - rupees with floating-point error (0.1 + 0.2 = 0.30000000000000004)
 *
 * These are the cases that catch off-by-one bugs in money code.
 */

import { describe, it, expect } from 'vitest';
import { paiseToRupees, rupeesToPaise } from '../../src/lib/flatten-rider';

describe('paiseToRupees — boundary values', () => {
  it('0 paise → 0 rupees', () => {
    expect(paiseToRupees(0)).toBe(0);
  });

  it('1 paise → 0.01 rupees (smallest representable amount)', () => {
    expect(paiseToRupees(1)).toBe(0.01);
  });

  it('99 paise → 0.99 rupees (just under ₹1, must not round up)', () => {
    // Bug surface: a "round up to nearest rupee" floor would
    // incorrectly turn ₹0.99 into ₹1.00 here.
    expect(paiseToRupees(99)).toBe(0.99);
  });

  it('100 paise → 1.00 rupees (exactly ₹1)', () => {
    expect(paiseToRupees(100)).toBe(1.0);
  });

  it('101 paise → 1.01 rupees (just over ₹1)', () => {
    expect(paiseToRupees(101)).toBe(1.01);
  });

  it('negative paise is passed through (caller-side validation expected)', () => {
    // The conversion is a pure math function — it does not
    // validate. A future refactor that adds validation should
    // update this test. For now, the contract is: paise in,
    // paise/100 out, no clamping.
    expect(paiseToRupees(-100)).toBe(-1.0);
  });

  it('MAX_SAFE_INTEGER paise → ~₹9 quadrillion (overflow surface)', () => {
    // Number.MAX_SAFE_INTEGER = 9_007_199_254_740_991. Divided by
    // 100 = 9.007e13. This is the upper bound of the function's
    // domain. A future change to BigInt or to a different unit
    // would break this assertion — the test exists to flag that.
    expect(paiseToRupees(Number.MAX_SAFE_INTEGER)).toBeCloseTo(
      Number.MAX_SAFE_INTEGER / 100,
      5,
    );
  });
});

describe('rupeesToPaise — boundary values', () => {
  it('0 rupees → 0 paise', () => {
    expect(rupeesToPaise(0)).toBe(0);
  });

  it('0.01 rupees → 1 paise (smallest representable amount)', () => {
    expect(rupeesToPaise(0.01)).toBe(1);
  });

  it('0.005 rupees → 1 paise (rounds up via Math.round bank-half-up)', () => {
    // Math.round(0.5) === 1 in JavaScript (rounds half toward
    // positive infinity for positive numbers). This is the
    // "round half up" convention. A future refactor to
    // "round half to even" (banker's rounding) would break
    // this — flag it.
    expect(rupeesToPaise(0.005)).toBe(1);
  });

  it('0.004 rupees → 0 paise (rounds down)', () => {
    expect(rupeesToPaise(0.004)).toBe(0);
  });

  it('1.00 rupees → 100 paise (exactly ₹1)', () => {
    expect(rupeesToPaise(1.0)).toBe(100);
  });

  it('1.005 rupees → 100 paise (floating-point drift, NOT 101)', () => {
    // Floating-point reality: 1.005 * 100 in JavaScript is
    // actually 100.49999999999999 (FP representation error),
    // not 100.5. Math.round therefore yields 100, not 101.
    // This is a known footgun. The test documents it so a
    // future "fix" (e.g. switching to a BigInt paise
    // representation) doesn't silently change rounding
    // behavior.
    expect(rupeesToPaise(1.005)).toBe(100);
  });

  it('1.50 rupees → 150 paise (clean half-up, no FP error)', () => {
    // 1.50 is exactly representable; Math.round(150) === 150.
    expect(rupeesToPaise(1.50)).toBe(150);
  });

  it('floating-point error case: 0.1 + 0.2 rounds cleanly', () => {
    // JavaScript: 0.1 + 0.2 = 0.30000000000000004. Math.round
    // should round to 30 paise (0.30 rupees), not 30.000000000000004
    // rupees worth of paise. This is the test that would have
    // caught a `Math.floor` or `Math.ceil` swap.
    expect(rupeesToPaise(0.1 + 0.2)).toBe(30);
  });

  it('rounds negative amounts toward zero (not away from zero)', () => {
    // Math.round in JavaScript rounds half toward positive
    // infinity. Math.round(-0.5) === 0, Math.round(-1.5) === -1.
    // After multiplying by 100 first, the values become
    // -50 and -150 respectively — no rounding boundary case
    // here, the answer is just the integer.
    expect(rupeesToPaise(-0.5)).toBe(-50);
    expect(rupeesToPaise(-1.5)).toBe(-150);
  });

  it('large amount: ₹1 crore → 10,000,000 paise (10^9)', () => {
    // 1_00_00_000 rupees = 10^7 rupees = 10^9 paise.
    expect(rupeesToPaise(1_00_00_000)).toBe(1_000_000_000);
  });
});

describe('roundtrip — rupees → paise → rupees', () => {
  it('whole-rupee amounts roundtrip cleanly', () => {
    expect(paiseToRupees(rupeesToPaise(1))).toBe(1);
    expect(paiseToRupees(rupeesToPaise(100))).toBe(100);
    expect(paiseToRupees(rupeesToPaise(12345))).toBe(12345);
  });

  it('half-paise is the lossy direction (₹0.005 → 1 paise → ₹0.01)', () => {
    // Roundtrip is asymmetric: rupees with sub-paise fractions
    // gain a paise on the way out. This is the trade-off for
    // using paise as the canonical integer unit. A future
    // refactor to a "minor unit = 1/10000 rupee" would change
    // this — the test documents the current behavior.
    expect(paiseToRupees(rupeesToPaise(0.005))).toBe(0.01);
  });
});
