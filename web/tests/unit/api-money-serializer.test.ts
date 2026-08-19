/**
 * API money serializer tests.
 *
 * PR-RUPEES-2026-08-08: the boundary-value tests at
 * `boundary-value-money-conversion.test.ts` cover the pure
 * paise↔rupee conversion math. This file covers the API
 * serializer (`toRupeesResponse`) — the function that walks an
 * object/array tree and renames `*InPaise` fields to `*InRupees`
 * with the value divided by 100.
 *
 * Why a separate file: the boundary tests document the math
 * surface. This file documents the wire-format surface (which
 * fields get renamed, how nested objects are handled, what
 * happens with arrays of objects, etc.).
 */

import { describe, it, expect } from 'vitest';
import { toRupeesResponse, rupeesKey } from '../../src/lib/api-money';

describe('toRupeesResponse — wire-format surface', () => {
  it('renames `*InPaise` keys to `*InRupees` and divides by 100', () => {
    const out = toRupeesResponse({
      riderId: 'r1',
      balanceInPaise: 100000, // ₹1,000.00
      pendingTopupsPaise: 5000, // ₹50.00
    });
    expect(out).toEqual({
      riderId: 'r1',
      balanceInRupees: 1000,
      pendingTopupsRupees: 50,
    });
  });

  it('passes through non-paise numeric fields unchanged', () => {
    // `trips` is a count, not a money value — must NOT be divided.
    const out = toRupeesResponse({
      riderId: 'r1',
      trips: 42,
      amountInPaise: 5000, // ₹50.00
    });
    expect(out).toEqual({
      riderId: 'r1',
      trips: 42,
      amountInRupees: 50,
    });
  });

  it('passes through non-paise string/date fields unchanged', () => {
    const date = new Date('2026-01-15T10:00:00Z');
    const out = toRupeesResponse({
      riderId: 'r1',
      status: 'APPROVED',
      createdAt: date,
      amountInPaise: 5000,
    });
    expect(out).toEqual({
      riderId: 'r1',
      status: 'APPROVED',
      createdAt: date,
      amountInRupees: 50,
    });
  });

  it('recurses into nested objects', () => {
    const out = toRupeesResponse({
      rider: { id: 'r1', wallet: { balanceInPaise: 100000 } },
    });
    expect(out).toEqual({
      rider: { id: 'r1', wallet: { balanceInRupees: 1000 } },
    });
  });

  it('handles arrays of objects (each item is mapped element-wise)', () => {
    const out = toRupeesResponse({
      transactions: [
        { id: 't1', amountInPaise: 5000 },
        { id: 't2', amountInPaise: 10000 },
      ],
    });
    expect(out).toEqual({
      transactions: [
        { id: 't1', amountInRupees: 50 },
        { id: 't2', amountInRupees: 100 },
      ],
    });
  });

  it('handles null input gracefully (returns null)', () => {
    expect(toRupeesResponse(null)).toBe(null);
  });

  it('handles undefined input gracefully (returns undefined)', () => {
    expect(toRupeesResponse(undefined)).toBe(undefined);
  });

  it('handles primitive input gracefully (returns as-is)', () => {
    expect(toRupeesResponse(42)).toBe(42);
    expect(toRupeesResponse('hello')).toBe('hello');
    expect(toRupeesResponse(true)).toBe(true);
  });

  it('boundary: 0 paise → 0 rupees (not null, not undefined)', () => {
    const out = toRupeesResponse({ balanceInPaise: 0 });
    expect(out).toEqual({ balanceInRupees: 0 });
  });

  it('boundary: 1 paise → 0.01 rupees (smallest representable amount)', () => {
    const out = toRupeesResponse({ balanceInPaise: 1 });
    expect(out).toEqual({ balanceInRupees: 0.01 });
  });

  it('boundary: MAX_SAFE_INTEGER paise does not throw', () => {
    const out = toRupeesResponse({ balanceInPaise: Number.MAX_SAFE_INTEGER });
    expect(out).toHaveProperty('balanceInRupees');
    expect(typeof (out as { balanceInRupees: number }).balanceInRupees).toBe('number');
    expect(Number.isFinite((out as { balanceInRupees: number }).balanceInRupees)).toBe(true);
  });

  it('does NOT touch bare `amount` key (mixed-units footgun avoidance)', () => {
    // The bare `amount` key is already in rupees in the codebase.
    // Touching it would be wrong (the audit found this exact footgun).
    const out = toRupeesResponse({ amount: 100 });
    expect(out).toEqual({ amount: 100 });
  });

  it('does NOT touch a key like `inPaise` (without the leading capital I)', () => {
    // The match is on the exact suffix `InPaise` (capital I). A
    // key like `inPaise` (lowercase) is not a money field and
    // must pass through unchanged.
    const out = toRupeesResponse({ inPaise: 100, balanceInPaise: 1000 });
    expect(out).toEqual({ inPaise: 100, balanceInRupees: 10 });
  });
});

describe('rupeesKey — name-only helper', () => {
  it('renames `*InPaise` to `*InRupees`', () => {
    expect(rupeesKey('balanceInPaise')).toBe('balanceInRupees');
    expect(rupeesKey('pendingTopupsPaise')).toBe('pendingTopupsRupees');
    expect(rupeesKey('amountInPaise')).toBe('amountInRupees');
  });

  it('passes through non-`InPaise` keys unchanged', () => {
    expect(rupeesKey('amount')).toBe('amount');
    expect(rupeesKey('riderId')).toBe('riderId');
  });
});
