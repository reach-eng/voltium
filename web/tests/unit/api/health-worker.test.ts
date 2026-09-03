import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: vi.fn().mockResolvedValue({ adminId: 'admin-1', adminRole: 'SUPER_ADMIN' }),
}));

const { GET } = await import('@/app/api/health/worker/route');

describe('GET /api/health/worker — Dedicated Worker Health Endpoint', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 200 healthy with outbox telemetry metrics when worker is operational', async () => {
    mockDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: 5 }]) // pendingCount
      .mockResolvedValueOnce([{ count: 2 }]) // failedCount
      .mockResolvedValueOnce([{ age_seconds: 12 }]) // oldestPendingAge
      .mockResolvedValueOnce([{ count: 0 }]); // stuckCount

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.status).toBe('healthy');
    expect(body.pending).toBe(5);
    expect(body.failed).toBe(2);
    expect(body.stuck).toBe(0);
    expect(body.oldestPendingAgeSeconds).toBe(12);
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.timestamp).toBeDefined();
  });

  it('returns 503 degraded when stuck events (>15 min) are detected', async () => {
    mockDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: 10 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ age_seconds: 1200 }])
      .mockResolvedValueOnce([{ count: 3 }]); // 3 stuck events!

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();

    expect(body.status).toBe('degraded');
    expect(body.stuck).toBe(3);
  });

  it('returns 503 unhealthy when database query throws fatal error', async () => {
    mockDb.$queryRawUnsafe.mockRejectedValueOnce(new Error('Connection lost'));

    const res = await GET();
    expect(res.status).toBe(503);
    const body = await res.json();

    expect(body.status).toBe('unhealthy');
    expect(body.error).toBe('Worker health check unavailable');
  });
});
