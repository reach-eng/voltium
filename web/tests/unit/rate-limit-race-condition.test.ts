import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Prisma } from '@prisma/client';

vi.stubEnv('NODE_ENV', 'production');
vi.stubEnv('APP_ENV', 'production');

const mockQuery = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    rateLimitBucket: {
      deleteMany: vi.fn().mockResolvedValue(undefined),
    },
    $queryRawUnsafe: mockQuery,
    $queryRaw: mockQuery,
  },
}));

describe('Rate Limit — SQL Atomic Upsert Race Condition Guard', () => {
  let checkRateLimit: (identifier: string, config?: any) => Promise<{ allowed: boolean; remaining: number; resetAt: number }>;

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    const mod = await import('@/lib/rate-limit');
    checkRateLimit = mod.checkRateLimit;
  });

  it('resets points to 1 on conflict when resetAt has expired (atomic window reset)', async () => {
    const { db } = await import('@/lib/db');
    const futureReset = new Date(Date.now() + 60000);

    // Simulate PostgreSQL returning points=1 and new resetAt when previous window expired
    vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([
      { points: 1, resetAt: futureReset },
    ]);

    const result = await checkRateLimit('user:race-test', { windowMs: 60000, maxRequests: 5 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(result.resetAt).toBe(futureReset.getTime());
  });

  it('correctly increments points within active window', async () => {
    const { db } = await import('@/lib/db');
    const futureReset = new Date(Date.now() + 60000);

    vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([
      { points: 3, resetAt: futureReset },
    ]);

    const result = await checkRateLimit('user:race-test', { windowMs: 60000, maxRequests: 5 });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it('blocks when points exceed maxRequests', async () => {
    const { db } = await import('@/lib/db');
    const futureReset = new Date(Date.now() + 60000);

    vi.mocked(db.$queryRawUnsafe).mockResolvedValueOnce([
      { points: 6, resetAt: futureReset },
    ]);

    const result = await checkRateLimit('user:race-test', { windowMs: 60000, maxRequests: 5 });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});
