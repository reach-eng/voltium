import { describe, it, expect } from 'vitest';
import {
  calculateExponentialBackoff,
  isMaxAttemptsExceeded,
  DEFAULT_BASE_BACKOFF_MS,
  DEFAULT_MAX_BACKOFF_MS,
  HARD_MAX_RETRY_LIMIT,
} from '@/lib/backoff';

describe('Exponential Backoff & Infinite-Retry Safeguards', () => {
  it('calculates exponential backoff based on attempts', () => {
    // base = 5000ms
    // attempt 1: 5000 * 2^1 = 10000ms
    expect(calculateExponentialBackoff(1)).toBe(10000);
    // attempt 2: 5000 * 2^2 = 20000ms
    expect(calculateExponentialBackoff(2)).toBe(20000);
    // attempt 3: 5000 * 2^3 = 40000ms
    expect(calculateExponentialBackoff(3)).toBe(40000);
  });

  it('strictly caps delay at maxMs (1 hour default)', () => {
    const delay = calculateExponentialBackoff(20); // very high attempt
    expect(delay).toBe(DEFAULT_MAX_BACKOFF_MS); // 3600000 ms = 1 hour
  });

  it('respects custom baseMs and maxMs options', () => {
    const delay = calculateExponentialBackoff(4, { baseMs: 1000, maxMs: 10000 });
    // 1000 * 2^4 = 16000 -> capped at 10000
    expect(delay).toBe(10000);
  });

  it('applies jitter within 50% to 100% of the calculated backoff window', () => {
    for (let i = 0; i < 20; i++) {
      const delay = calculateExponentialBackoff(2, { jitter: true });
      // nominal delay for attempt 2 is 20000ms
      // with jitter: 10000ms <= delay <= 20000ms
      expect(delay).toBeGreaterThanOrEqual(10000);
      expect(delay).toBeLessThanOrEqual(20000);
    }
  });

  it('isMaxAttemptsExceeded enforces system-wide hard ceiling', () => {
    // Normal configured limit 3
    expect(isMaxAttemptsExceeded(2, 3)).toBe(false);
    expect(isMaxAttemptsExceeded(3, 3)).toBe(true);

    // Default when unconfigured (defaults to 3)
    expect(isMaxAttemptsExceeded(2)).toBe(false);
    expect(isMaxAttemptsExceeded(3)).toBe(true);

    // Unsafe infinite attempt configuration (e.g. 100 or undefined) capped at HARD_MAX_RETRY_LIMIT (10)
    expect(isMaxAttemptsExceeded(9, 100)).toBe(false);
    expect(isMaxAttemptsExceeded(10, 100)).toBe(true);
    expect(isMaxAttemptsExceeded(11, 100)).toBe(true);
  });
});
