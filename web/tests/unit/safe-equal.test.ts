/**
 * 9.5+ Hardening §6 (T-9P0-3) — unit test for `safeEqualSecret`.
 *
 * Invariants:
 *   1. Same input → true.
 *   2. Differing input of equal length → false.
 *   3. Differing length → false (lengths are not secret, but a
 *      length-only oracle is enough to mount an attack; the early
 *      return is still constant time over the length bit-width).
 *   4. Empty / null / undefined inputs → false.
 *   5. The function does not throw on odd inputs.
 *
 * Note: vitest's "node" environment exposes `node:crypto` so we can
 * import the real `timingSafeEqual` and rely on Node's constant-time
 * guarantee. We do NOT mock the crypto module.
 */
import { describe, it, expect } from 'vitest';
import { safeEqualSecret } from '@/lib/safe-equal';

describe('safeEqualSecret (9.5+ T-9P0-3)', () => {
  it('returns true for equal strings', () => {
    expect(safeEqualSecret('hunter2-abcdef', 'hunter2-abcdef')).toBe(true);
  });

  it('returns false for differing strings of equal length', () => {
    expect(safeEqualSecret('hunter2-abcdeX', 'hunter2-abcdeY')).toBe(false);
  });

  it('returns false for differing length', () => {
    expect(safeEqualSecret('short', 'longer-string-here')).toBe(false);
    expect(safeEqualSecret('longer-string-here', 'short')).toBe(false);
  });

  it('returns false for null provided', () => {
    expect(safeEqualSecret(null, 'expected')).toBe(false);
  });

  it('returns false for undefined provided', () => {
    expect(safeEqualSecret(undefined, 'expected')).toBe(false);
  });

  it('returns false for empty string provided', () => {
    expect(safeEqualSecret('', 'expected')).toBe(false);
  });

  it('returns false for null expected', () => {
    expect(safeEqualSecret('provided', null as unknown as undefined)).toBe(false);
  });

  it('returns false for undefined expected', () => {
    expect(safeEqualSecret('provided', undefined)).toBe(false);
  });

  it('handles unicode in provided vs ascii in expected of equal byte length', () => {
    // "🚀" is 4 bytes in UTF-8; "abcd" is 4 bytes. Different content,
    // equal byte length. Should be false (and constant-time over the
    // 4-byte buffer).
    expect(safeEqualSecret('🚀', 'abcd')).toBe(false);
  });

  it('does not throw on weird inputs', () => {
    expect(() => safeEqualSecret('x', 'y')).not.toThrow();
    // Both empty → falsy inputs → return false (an empty string is
    // not a real configured secret). This is intentional: a missing
    // INTERNAL_METRICS_TOKEN should fail closed.
    expect(safeEqualSecret('', '')).toBe(false);
  });
});
