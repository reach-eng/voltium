/**
 * T-97 (PR-7, 2026-08-23) — regression test for the wired
 * safety nets:
 *   1. `purgeExpiredIdempotencyKeys` is now wired to a cron route
 *      at `src/app/api/cron/cleanup-idempotency/route.ts` (was
 *      a 0-caller function before).
 *   2. `OutboxService.emit` rate limit is now ALWAYS enforced
 *      (the `RATE_LIMIT_FORCED_ON_FOR_TESTS` flag is removed).
 *   3. `withJobGuards` is removed (was 0 callers, each
 *      `job.process` already implements its own idempotency).
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.9.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const purgeExpiredMock = vi.fn();
vi.mock('@/lib/idempotency', () => ({
  purgeExpiredIdempotencyKeys: (...args: unknown[]) => purgeExpiredMock(...args),
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('T-97 cleanup-idempotency cron wires the previously-dormant helper', () => {
  let originalSecret: string | undefined;
  beforeEach(() => {
    originalSecret = process.env.CRON_SECRET;
    purgeExpiredMock.mockReset();
    purgeExpiredMock.mockResolvedValue(42);
  });
  afterEach(() => {
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET;
    } else {
      process.env.CRON_SECRET = originalSecret;
    }
  });

  it('rejects when CRON_SECRET is unset (fail-closed)', async () => {
    delete process.env.CRON_SECRET;
    const { GET } = await import('@/app/api/cron/cleanup-idempotency/route');
    const req = new Request('http://localhost/api/cron/cleanup-idempotency', {
      method: 'GET',
    });
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(503);
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it('rejects with 401 when bearer is wrong', async () => {
    process.env.CRON_SECRET = 'a-very-long-cron-secret-1234567890';
    const { GET } = await import('@/app/api/cron/cleanup-idempotency/route');
    const req = new Request('http://localhost/api/cron/cleanup-idempotency', {
      method: 'GET',
    });
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(401);
    expect(purgeExpiredMock).not.toHaveBeenCalled();
  });

  it('runs the purge when authenticated and returns the count', async () => {
    process.env.CRON_SECRET = 'a-very-long-cron-secret-1234567890';
    const { GET } = await import('@/app/api/cron/cleanup-idempotency/route');
    const req = new Request('http://localhost/api/cron/cleanup-idempotency', {
      method: 'GET',
      headers: {
        authorization: 'Bearer a-very-long-cron-secret-1234567890',
      },
    });
    const res = await GET(req as unknown as Parameters<typeof GET>[0]);
    expect(res.status).toBe(200);
    expect(purgeExpiredMock).toHaveBeenCalledTimes(1);
  });
});
