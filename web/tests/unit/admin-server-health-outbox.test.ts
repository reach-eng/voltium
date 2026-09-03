import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockDb = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $queryRawUnsafe: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));

const { GET } = await import('@/app/api/health/route');

describe('Admin Server Health — Outbox Queue Depth Telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('GET /api/health?detailed=true exposes outbox queue depth, failed count, stuck count and age to admin', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: 18 }]) // pendingCount / queueDepth
      .mockResolvedValueOnce([{ count: 3 }]) // failedCount
      .mockResolvedValueOnce([{ age_seconds: 45 }]) // oldest age
      .mockResolvedValueOnce([{ count: 0 }]); // stuckCount

    const req = new NextRequest('http://localhost:8081/api/health?detailed=true');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.checks.outbox).toBeDefined();
    expect(body.checks.outbox.status).toBe('healthy');
    expect(body.checks.outbox.queueDepth).toBe(18);
    expect(body.checks.outbox.failedCount).toBe(3);
    expect(body.checks.outbox.stuckCount).toBe(0);
    expect(body.checks.outbox.oldestPendingAgeSeconds).toBe(45);
  });

  it('GET /api/health includes summary outbox status and queue depth', async () => {
    mockDb.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: 7 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ age_seconds: 10 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    const req = new NextRequest('http://localhost:8081/api/health');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.checks.outbox).toBeDefined();
    expect(body.checks.outbox.status).toBe('healthy');
    expect(body.checks.outbox.queueDepth).toBe(7);
  });
});
