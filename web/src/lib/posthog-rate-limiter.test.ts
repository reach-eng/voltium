import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PostHogRateLimiter } from './posthog-rate-limiter';

describe('PostHogRateLimiter', () => {
  let originalDate: typeof Date;

  beforeEach(() => {
    originalDate = global.Date;
  });

  afterEach(() => {
    global.Date = originalDate;
    vi.restoreAllMocks();
  });

  it('allows events under the cap', () => {
    const limiter = new PostHogRateLimiter(10);
    for (let i = 0; i < 10; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }
  });

  it('blocks events at the cap', () => {
    const limiter = new PostHogRateLimiter(3);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(true);
    expect(limiter.tryConsume()).toBe(false);
    expect(limiter.tryConsume()).toBe(false);
  });

  it('reports the current count', () => {
    const limiter = new PostHogRateLimiter(10);
    expect(limiter.getCount()).toBe(0);
    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.getCount()).toBe(2);
  });

  it('resets the counter manually', () => {
    const limiter = new PostHogRateLimiter(2);
    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.tryConsume()).toBe(false);
    limiter.reset();
    expect(limiter.getCount()).toBe(0);
    expect(limiter.tryConsume()).toBe(true);
  });

  it('resets the counter when the month changes', () => {
    // Mock Date with vi.useFakeTimers + setSystemTime
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-15T10:00:00Z'));

    const limiter = new PostHogRateLimiter(2);
    limiter.tryConsume();
    limiter.tryConsume();
    expect(limiter.tryConsume()).toBe(false);

    // Advance to February
    vi.setSystemTime(new Date('2026-02-01T10:00:00Z'));

    expect(limiter.getCount()).toBe(0);
    expect(limiter.tryConsume()).toBe(true);

    vi.useRealTimers();
  });

  it('uses the default cap of 800k when not specified', () => {
    const limiter = new PostHogRateLimiter();
    expect(limiter.tryConsume()).toBe(true);
    // We can't easily test 800k events, but we can verify the cap
    // is large enough that a few events always pass.
    for (let i = 0; i < 100; i++) {
      expect(limiter.tryConsume()).toBe(true);
    }
  });
});
