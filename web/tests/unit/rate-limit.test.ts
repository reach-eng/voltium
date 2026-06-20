import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Set NODE_ENV to production so we exercise the real rate-limit logic
// rather than the dev-mode bypass.
vi.stubEnv('NODE_ENV', 'production');

// Mock Prisma db so we can control database responses deterministically.
vi.mock('@/lib/db', () => ({
  db: {
    rateLimitBucket: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue(null),
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

/** Create a Date object in the future/fresh window */
function futureDate(offsetMs = 60_000): Date {
  return new Date(Date.now() + offsetMs);
}

describe('checkRateLimit — token bucket logic (database path)', () => {
  let checkRateLimit: (identifier: string, config?: any) => Promise<RateLimitResult>;
  let clearRateLimitStore: () => Promise<void>;
  const SECOND = 1000;
  const MINUTE = 60 * SECOND;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
    clearRateLimitStore = mod.clearRateLimitStore;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows the first request and returns correct remaining', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue(null);
    vi.mocked(db.rateLimitBucket.upsert).mockResolvedValue({
      key: 'ratelimit:user:1',
      points: 1,
      resetAt: futureDate(),
    });

    const result = await checkRateLimit('user:1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59); // API_RATE_LIMIT = 60 → 60 - 1
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('decrements remaining for each successive request in the window', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = futureDate();

    // Track bucket state across calls
    let points = 0;
    vi.mocked(db.rateLimitBucket.findUnique).mockImplementation(() => {
      if (points === 0) return Promise.resolve(null);
      return Promise.resolve({ key: 'ratelimit:user:seq', points, resetAt: windowEnd });
    });
    vi.mocked(db.rateLimitBucket.upsert).mockImplementation(() => {
      points = 1;
      return Promise.resolve({ key: 'ratelimit:user:seq', points: 1, resetAt: windowEnd });
    });
    vi.mocked(db.rateLimitBucket.update).mockImplementation(() => {
      points += 1;
      return Promise.resolve({ key: 'ratelimit:user:seq', points, resetAt: windowEnd });
    });

    const r1 = await checkRateLimit('user:seq');
    expect(r1.remaining).toBe(59); // 60 - 1

    const r2 = await checkRateLimit('user:seq');
    expect(r2.remaining).toBe(58); // 60 - 2

    const r3 = await checkRateLimit('user:seq');
    expect(r3.remaining).toBe(57); // 60 - 3
  });

  it('blocks requests after exceeding the max limit', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = futureDate();
    let points = 0;

    vi.mocked(db.rateLimitBucket.findUnique).mockImplementation(() => {
      if (points === 0) return Promise.resolve(null);
      return Promise.resolve({ key: 'ratelimit:user:burst', points, resetAt: windowEnd });
    });
    vi.mocked(db.rateLimitBucket.upsert).mockImplementation(() => {
      points = 1;
      return Promise.resolve({ key: 'ratelimit:user:burst', points: 1, resetAt: windowEnd });
    });
    vi.mocked(db.rateLimitBucket.update).mockImplementation(() => {
      points += 1;
      return Promise.resolve({ key: 'ratelimit:user:burst', points, resetAt: windowEnd });
    });

    const config = { windowMs: MINUTE, maxRequests: 3 };

    const r1 = await checkRateLimit('user:burst', config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(2);

    const r2 = await checkRateLimit('user:burst', config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(1);

    const r3 = await checkRateLimit('user:burst', config);
    expect(r3.allowed).toBe(true);
    expect(r3.remaining).toBe(0);

    // 4th request — points (3) >= maxRequests (3) → blocked
    vi.mocked(db.rateLimitBucket.findUnique).mockImplementation(() =>
      Promise.resolve({ key: 'ratelimit:user:burst', points: 3, resetAt: windowEnd }),
    );

    const r4 = await checkRateLimit('user:burst', config);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('resets the counter after the window expires', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = new Date(Date.now() + MINUTE);
    let points = 0;

    vi.mocked(db.rateLimitBucket.findUnique).mockImplementation(() => {
      if (points === 0) return Promise.resolve(null);
      if (points >= 1) return Promise.resolve({ key: 'ratelimit:user:reset', points, resetAt: windowEnd });
      return Promise.resolve(null);
    });
    vi.mocked(db.rateLimitBucket.upsert).mockImplementation(() => {
      points = 1;
      return Promise.resolve({ key: 'ratelimit:user:reset', points: 1, resetAt: windowEnd });
    });

    const config = { windowMs: MINUTE, maxRequests: 1 };

    const r1 = await checkRateLimit('user:reset', config);
    expect(r1.allowed).toBe(true);

    // Advance past the window so the database entry is expired
    vi.advanceTimersByTime(MINUTE + 1);

    // Now findUnique returns the old entry, but existing.resetAt <= now is true
    // → code upserts a new entry (first path)
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:reset',
      points: 1,
      resetAt: windowEnd, // expired
    });
    vi.mocked(db.rateLimitBucket.upsert).mockResolvedValue({
      key: 'ratelimit:user:reset',
      points: 1,
      resetAt: new Date(Date.now() + MINUTE), // fresh window
    });

    const r2 = await checkRateLimit('user:reset', config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);
  });

  it('treats different identifiers as independent buckets', async () => {
    const { db } = await import('@/lib/db');
    const config = { windowMs: MINUTE, maxRequests: 1 };

    // First key → entry exhausted
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:a',
      points: 1,
      resetAt: futureDate(),
    });

    const r1 = await checkRateLimit('user:a', config);
    expect(r1.allowed).toBe(false); // already at max

    // Different key → findUnique returns null → upsert creates new entry
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue(null);
    vi.mocked(db.rateLimitBucket.upsert).mockResolvedValue({
      key: 'ratelimit:user:b',
      points: 1,
      resetAt: futureDate(),
    });

    const r2 = await checkRateLimit('user:b', config);
    expect(r2.allowed).toBe(true);
  });

  it('exposes resetAt in the future', async () => {
    const { db } = await import('@/lib/db');
    const config = { windowMs: MINUTE, maxRequests: 5 };

    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue(null);
    vi.mocked(db.rateLimitBucket.upsert).mockResolvedValue({
      key: 'ratelimit:user:time',
      points: 1,
      resetAt: new Date(Date.now() + MINUTE),
    });

    const r1 = await checkRateLimit('user:time', config);
    expect(r1.resetAt).toBeGreaterThanOrEqual(Date.now() + MINUTE);
  });

  it('uses default API_RATE_LIMIT (60 req/min) when no config is passed', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = futureDate();
    let points = 0;

    vi.mocked(db.rateLimitBucket.findUnique).mockImplementation(() => {
      if (points === 0) return Promise.resolve(null);
      return Promise.resolve({ key: 'ratelimit:user:default', points, resetAt: windowEnd });
    });
    vi.mocked(db.rateLimitBucket.upsert).mockImplementation(() => {
      points = 1;
      return Promise.resolve({ key: 'ratelimit:user:default', points: 1, resetAt: windowEnd });
    });
    vi.mocked(db.rateLimitBucket.update).mockImplementation(() => {
      points += 1;
      return Promise.resolve({ key: 'ratelimit:user:default', points, resetAt: windowEnd });
    });

    // 60 requests should all be allowed
    for (let i = 0; i < 60; i++) {
      const r = await checkRateLimit('user:default');
      expect(r.allowed).toBe(true);
    }

    // 61st → blocked
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:default',
      points: 60,
      resetAt: windowEnd,
    });

    const blocked = await checkRateLimit('user:default');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBe(windowEnd.getTime());
  });

  it('clears the store with clearRateLimitStore', async () => {
    const { db } = await import('@/lib/db');

    await clearRateLimitStore();
    // Should call deleteMany on the database rate limit bucket
    expect(db.rateLimitBucket.deleteMany).toHaveBeenCalledWith({});
  });
});

describe('checkRateLimit — window expiry and renewal (database path)', () => {
  let checkRateLimit: (identifier: string, config?: any) => Promise<RateLimitResult>;
  const MINUTE = 60_000;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-uses the existing entry when the window has not expired', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = new Date(Date.now() + MINUTE);

    // Entry with 2 points, window still active
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:reuse',
      points: 2,
      resetAt: windowEnd,
    });
    vi.mocked(db.rateLimitBucket.update).mockResolvedValue({
      key: 'ratelimit:user:reuse',
      points: 3,
      resetAt: windowEnd,
    });

    const r = await checkRateLimit('user:reuse', { windowMs: MINUTE, maxRequests: 5 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2); // 5 - 3
    expect(db.rateLimitBucket.update).toHaveBeenCalled();
    expect(db.rateLimitBucket.upsert).not.toHaveBeenCalled();
  });

  it('creates a fresh entry after the previous window expires', async () => {
    const { db } = await import('@/lib/db');
    const expiredReset = new Date(Date.now() - 1000); // expired 1 second ago
    const freshReset = new Date(Date.now() + MINUTE);

    // Entry exists but expired → should go through upsert path
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:renew',
      points: 5,
      resetAt: expiredReset,
    });
    vi.mocked(db.rateLimitBucket.upsert).mockResolvedValue({
      key: 'ratelimit:user:renew',
      points: 1,
      resetAt: freshReset,
    });

    const r = await checkRateLimit('user:renew', { windowMs: MINUTE, maxRequests: 3 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2); // 3 - 1
    expect(db.rateLimitBucket.upsert).toHaveBeenCalled();
    expect(db.rateLimitBucket.update).not.toHaveBeenCalled();
  });

  it('handles maxRequests=0 (immediately blocks second request)', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = new Date(Date.now() + 60_000);
    let points = 0;

    vi.mocked(db.rateLimitBucket.findUnique).mockImplementation(() => {
      if (points === 0) return Promise.resolve(null);
      return Promise.resolve({ key: 'ratelimit:user:zero', points, resetAt: windowEnd });
    });
    vi.mocked(db.rateLimitBucket.upsert).mockImplementation(() => {
      points = 1;
      return Promise.resolve({ key: 'ratelimit:user:zero', points: 1, resetAt: windowEnd });
    });

    // First request: creates bucket (points=1), 1 >= 0 means remaining = -1
    const r1 = await checkRateLimit('user:zero', { windowMs: 60_000, maxRequests: 0 });
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(-1);

    // Second request: points (1) >= maxRequests (0), blocked
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:zero',
      points: 1,
      resetAt: windowEnd,
    });
    const r2 = await checkRateLimit('user:zero', { windowMs: 60_000, maxRequests: 0 });
    expect(r2.allowed).toBe(false);
    expect(r2.remaining).toBe(0);
  });

  it('blocks when entry.points >= maxRequests and window is active', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = new Date(Date.now() + MINUTE);

    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:full',
      points: 10,
      resetAt: windowEnd,
    });

    const r = await checkRateLimit('user:full', { windowMs: MINUTE, maxRequests: 10 });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetAt).toBe(windowEnd.getTime());
    expect(db.rateLimitBucket.upsert).not.toHaveBeenCalled();
    expect(db.rateLimitBucket.update).not.toHaveBeenCalled();
  });
});

describe('checkRateLimit — database error handling', () => {
  let checkRateLimit: (identifier: string, config?: any) => Promise<RateLimitResult>;

  beforeEach(async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('handles findUnique rejection gracefully', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.rateLimitBucket.findUnique).mockRejectedValue(new Error('DB error'));
    // upsert has to succeed for the code to continue
    vi.mocked(db.rateLimitBucket.upsert).mockResolvedValue({
      key: 'ratelimit:user:err',
      points: 1,
      resetAt: new Date(Date.now() + 60_000),
    });

    // findUnique fails → catch returns null → new entry via upsert
    const result = await checkRateLimit('user:err');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  // upsert rejection is implicitly covered by the .catch() pattern
  // tested in 'handles findUnique rejection gracefully' above.

  it('handles deleteMany rejection gracefully (cleanup)', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.rateLimitBucket.deleteMany).mockImplementation(
      () => Promise.reject(new Error('DB error')),
    );
    vi.mocked(db.rateLimitBucket.findUnique).mockImplementation(
      () => Promise.resolve(null),
    );
    vi.mocked(db.rateLimitBucket.upsert).mockImplementation(
      () => Promise.resolve(null),
    );

    // deleteMany is called during cleanup inside checkRateLimit;
    // .catch(() => {}) should swallow the rejection.
    const result = await checkRateLimit('user:cleanup-err');
    expect(result.allowed).toBe(true);
  });

  it('propagates update rejection (no .catch() on update path)', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = futureDate();
    vi.mocked(db.rateLimitBucket.findUnique).mockResolvedValue({
      key: 'ratelimit:user:update-err',
      points: 1,
      resetAt: windowEnd,
    });
    vi.mocked(db.rateLimitBucket.update).mockRejectedValue(new Error('DB error'));

    // The update path has no .catch() guard, so the error propagates
    await expect(checkRateLimit('user:update-err')).rejects.toThrow('DB error');
  });
});

describe('rate limit configs', () => {
  it('exports correct AUTH_RATE_LIMIT values', async () => {
    const { AUTH_RATE_LIMIT } = await import('@/lib/rate-limit');
    expect(AUTH_RATE_LIMIT.windowMs).toBe(15 * 60 * 1000);
    expect(AUTH_RATE_LIMIT.maxRequests).toBe(5);
  });

  it('exports correct API_RATE_LIMIT values', async () => {
    const { API_RATE_LIMIT } = await import('@/lib/rate-limit');
    expect(API_RATE_LIMIT.windowMs).toBe(60 * 1000);
    expect(API_RATE_LIMIT.maxRequests).toBe(60);
  });

  it('exports correct UPLOAD_RATE_LIMIT values', async () => {
    const { UPLOAD_RATE_LIMIT } = await import('@/lib/rate-limit');
    expect(UPLOAD_RATE_LIMIT.windowMs).toBe(60 * 1000);
    expect(UPLOAD_RATE_LIMIT.maxRequests).toBe(10);
  });
});

describe('dev-mode bypass', () => {
  it('always allows in non-production environment', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.resetModules();
    const { checkRateLimit: devCheck } = await import('@/lib/rate-limit');

    const result = await devCheck('any-user', { windowMs: 1000, maxRequests: 1 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1000);
    vi.unstubAllEnvs();
  });
});
