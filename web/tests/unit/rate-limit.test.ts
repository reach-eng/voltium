import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('NODE_ENV', 'production');
vi.stubEnv('APP_ENV', 'production');

const mockQuery = vi.fn().mockResolvedValue([{ points: 1, resetAt: new Date(Date.now() + 60000) }]);

vi.mock('@/lib/db', () => ({
  db: {
    rateLimitBucket: {
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
    $queryRawUnsafe: mockQuery,
    $queryRaw: mockQuery,
  },
}));

type RateLimitResult = { allowed: boolean; remaining: number; resetAt: number };

function futureDate(offsetMs = 60_000): Date {
  return new Date(Date.now() + offsetMs);
}

describe('checkRateLimit — token bucket logic (database path)', () => {
  let checkRateLimit: (identifier: string, config?: any) => Promise<RateLimitResult>;
  let clearRateLimitStore: () => Promise<void>;
  const MINUTE = 60 * 1000;

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
    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 1, resetAt: futureDate() }]);

    const result = await checkRateLimit('user:1');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('decrements remaining for each successive request in the window', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = futureDate();
    let points = 0;

    vi.mocked(db.$queryRawUnsafe).mockImplementation(() => {
      points += 1;
      return Promise.resolve([{ points, resetAt: windowEnd }]);
    });

    const r1 = await checkRateLimit('user:seq');
    expect(r1.remaining).toBe(59);

    const r2 = await checkRateLimit('user:seq');
    expect(r2.remaining).toBe(58);

    const r3 = await checkRateLimit('user:seq');
    expect(r3.remaining).toBe(57);
  });

  it('blocks requests after exceeding the max limit', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = futureDate();
    let points = 0;

    vi.mocked(db.$queryRawUnsafe).mockImplementation(() => {
      points = Math.min(points + 1, 4);
      return Promise.resolve([{ points, resetAt: windowEnd }]);
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

    const r4 = await checkRateLimit('user:burst', config);
    expect(r4.allowed).toBe(false);
    expect(r4.remaining).toBe(0);
  });

  it('resets the counter after the window expires', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = new Date(Date.now() + MINUTE);
    let points = 0;

    vi.mocked(db.$queryRawUnsafe).mockImplementation(() => {
      points += 1;
      return Promise.resolve([{ points, resetAt: windowEnd }]);
    });

    const config = { windowMs: MINUTE, maxRequests: 1 };

    const r1 = await checkRateLimit('user:reset', config);
    expect(r1.allowed).toBe(true);

    vi.advanceTimersByTime(MINUTE + 1);

    const freshReset = new Date(Date.now() + MINUTE);
    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 1, resetAt: freshReset }]);

    const r2 = await checkRateLimit('user:reset', config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);
  });

  it('treats different identifiers as independent buckets', async () => {
    const { db } = await import('@/lib/db');
    const config = { windowMs: MINUTE, maxRequests: 1 };

    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 1, resetAt: futureDate() }]);
    const r1 = await checkRateLimit('user:a', config);
    expect(r1.allowed).toBe(true);

    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 2, resetAt: futureDate() }]);
    const r2 = await checkRateLimit('user:a', config);
    expect(r2.allowed).toBe(false);

    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 1, resetAt: futureDate() }]);
    const r3 = await checkRateLimit('user:b', config);
    expect(r3.allowed).toBe(true);
  });

  it('exposes resetAt from the result', async () => {
    const { db } = await import('@/lib/db');
    const expectedResetAt = new Date(Date.now() + MINUTE);
    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 1, resetAt: expectedResetAt }]);

    const r1 = await checkRateLimit('user:time', { windowMs: MINUTE, maxRequests: 5 });
    expect(r1.resetAt).toBe(expectedResetAt.getTime());
  });

  it('uses default API_RATE_LIMIT (60 req/min) when no config is passed', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = futureDate();
    let callCount = 0;

    vi.mocked(db.$queryRawUnsafe).mockImplementation(() => {
      callCount++;
      const points = Math.min(callCount, 61);
      return Promise.resolve([{ points, resetAt: windowEnd }]);
    });

    for (let i = 0; i < 60; i++) {
      const r = await checkRateLimit('user:default');
      expect(r.allowed).toBe(true);
    }

    const blocked = await checkRateLimit('user:default');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBe(windowEnd.getTime());
  });

  it('clears the store with clearRateLimitStore', async () => {
    const { db } = await import('@/lib/db');

    await clearRateLimitStore();
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

  it('handles maxRequests=0 (all requests blocked)', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 1, resetAt: futureDate() }]);

    const r1 = await checkRateLimit('user:zero', { windowMs: 60_000, maxRequests: 0 });
    expect(r1.allowed).toBe(false);
    expect(r1.remaining).toBe(0);
  });

  it('blocks when entry.points >= maxRequests and window is active', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = new Date(Date.now() + MINUTE);

    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 11, resetAt: windowEnd }]);
    const r = await checkRateLimit('user:full', { windowMs: MINUTE, maxRequests: 10 });
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
    expect(r.resetAt).toBe(windowEnd.getTime());
  });

  it('allows within limit after partial usage', async () => {
    const { db } = await import('@/lib/db');
    const windowEnd = new Date(Date.now() + MINUTE);

    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 3, resetAt: windowEnd }]);
    const r = await checkRateLimit('user:partial', { windowMs: MINUTE, maxRequests: 5 });
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(2);
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

  it('fails closed when $queryRawUnsafe rejects and failClosed is true', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.$queryRawUnsafe).mockRejectedValue(new Error('DB error'));

    const result = await checkRateLimit('user:auth-err', { windowMs: 60_000, maxRequests: 5, failClosed: true });
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fails open when $queryRawUnsafe rejects and failClosed is false', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.$queryRawUnsafe).mockRejectedValue(new Error('DB error'));

    const result = await checkRateLimit('user:open-err', { windowMs: 60_000, maxRequests: 5, failClosed: false });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('fails open by default (failClosed is undefined)', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.$queryRawUnsafe).mockRejectedValue(new Error('DB error'));

    const result = await checkRateLimit('user:default-err');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it('handles deleteMany rejection gracefully (cleanup)', async () => {
    const { db } = await import('@/lib/db');
    vi.mocked(db.rateLimitBucket.deleteMany).mockRejectedValue(new Error('DB error'));
    vi.mocked(db.$queryRawUnsafe).mockResolvedValue([{ points: 1, resetAt: new Date(Date.now() + 60_000) }]);

    const result = await checkRateLimit('user:cleanup-err');
    expect(result.allowed).toBe(true);
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
