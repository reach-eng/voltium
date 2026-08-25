/**
 * W4 / PR-1 tests for `extractErrorMessage` and `toErrorLike`.
 *
 * Every shape we receive from a 5xx body, a thrown network error, or
 * a hand-rolled `new Error('...')` must produce a non-empty string.
 */
import { describe, it, expect } from 'vitest';
import { extractErrorMessage, toErrorLike } from '@/lib/error-utils';

describe('extractErrorMessage', () => {
  it('returns the fallback for null and undefined', () => {
    expect(extractErrorMessage(null, 'fallback')).toBe('fallback');
    expect(extractErrorMessage(undefined, 'fallback')).toBe('fallback');
  });

  it('returns the fallback for an empty string', () => {
    expect(extractErrorMessage('', 'fallback')).toBe('fallback');
    expect(extractErrorMessage('   ', 'fallback')).toBe('fallback');
  });

  it('returns a non-empty string input unchanged (after trim)', () => {
    expect(extractErrorMessage('Couldn\'t load backups', 'fb')).toBe("Couldn't load backups");
    expect(extractErrorMessage('  trimmed  ', 'fb')).toBe('trimmed');
  });

  it('extracts message from an Error instance', () => {
    expect(extractErrorMessage(new Error('boom'), 'fb')).toBe('boom');
  });

  it('falls back to the type name when an Error has no message', () => {
    const e = new TypeError('');
    // TypeError('') is an empty message — the helper must NOT leak
    // an empty toast. Falls through to the fallback.
    expect(extractErrorMessage(e, 'fallback')).toBe('fallback');
  });

  it('plucks `message` from a plain server-shaped object', () => {
    expect(extractErrorMessage({ message: 'rate limit exceeded' }, 'fb')).toBe(
      'rate limit exceeded'
    );
  });

  it('plucks `error` (legacy string) from a plain server-shaped object', () => {
    expect(extractErrorMessage({ error: 'no rows' }, 'fb')).toBe('no rows');
  });

  it('plucks `error.message` from a nested envelope', () => {
    expect(extractErrorMessage({ error: { message: 'nested error' } }, 'fb')).toBe(
      'nested error'
    );
  });

  it('prefers `message` over `error`', () => {
    expect(extractErrorMessage({ message: 'first', error: 'second' }, 'fb')).toBe('first');
  });

  it('falls back when the object has no usable string field', () => {
    expect(extractErrorMessage({ code: 'INTERNAL', status: 500 }, 'fb')).toBe('fb');
  });

  it('does not stringify arbitrary objects (no JSON dumps in toasts)', () => {
    // The old toString-style fallback would yield "[object Object]" for
    // an Error-shaped object without a message. The new contract: never
    // emit "[object Object]" — either the meaningful message, or the
    // caller's fallback.
    expect(extractErrorMessage({ code: 'INTERNAL' }, 'fb')).not.toBe('[object Object]');
  });

  it('uses the default fallback when none is supplied', () => {
    expect(extractErrorMessage(null)).toBe('Something went wrong');
  });

  it('always returns a string, never null/undefined', () => {
    const results = [
      extractErrorMessage(undefined, 'fb'),
      extractErrorMessage(null, 'fb'),
      extractErrorMessage(0, 'fb'),
      extractErrorMessage(false, 'fb'),
      extractErrorMessage({}, 'fb'),
      extractErrorMessage([], 'fb'),
      extractErrorMessage(new Error(), 'fb'),
    ];
    for (const r of results) {
      expect(typeof r).toBe('string');
      expect(r.length).toBeGreaterThan(0);
    }
  });
});

describe('toErrorLike', () => {
  it('returns an Error with the extracted message', () => {
    const e = toErrorLike({ message: 'failed' }, 'fb');
    expect(e).toBeInstanceOf(Error);
    expect(e.message).toBe('failed');
  });

  it('falls back when input has no message', () => {
    const e = toErrorLike({}, 'fb');
    expect(e.message).toBe('fb');
  });
});
