import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockDb = vi.hoisted(() => ({
  $queryRawUnsafe: vi.fn(),
}));

const mockAuth = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mockAuth.requireAdmin,
  adminUnauthorized: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 }),
}));
vi.mock('@/lib/auth', () => ({
  hasPermission: mockAuth.hasPermission,
}));

const { GET } = await import('@/app/api/admin/server-health/route');

describe('GET /api/admin/server-health — Admin Server Health & Outbox Queue Depth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects unauthenticated requests with 401', async () => {
    mockAuth.requireAdmin.mockResolvedValue(null);
    const req = new NextRequest('http://localhost:8081/api/admin/server-health');
    const res = await GET(req);

    expect(res.status).toBe(401);
  });

  it('rejects admins without required permissions with 403', async () => {
    mockAuth.requireAdmin.mockResolvedValue({ adminId: 'adm_1', adminRole: 'VIEWER' });
    mockAuth.hasPermission.mockReturnValue(false);

    const req = new NextRequest('http://localhost:8081/api/admin/server-health');
    const res = await GET(req);

    expect(res.status).toBe(403);
  });

  it('returns outbox queue depth and server health telemetry to authorized admins', async () => {
    mockAuth.requireAdmin.mockResolvedValue({ adminId: 'adm_1', adminRole: 'SUPER_ADMIN' });
    mockAuth.hasPermission.mockReturnValue(true);

    mockDb.$queryRawUnsafe
      .mockResolvedValueOnce([{ count: 14 }]) // pendingCount / queueDepth
      .mockResolvedValueOnce([{ count: 2 }]) // processingCount
      .mockResolvedValueOnce([{ count: 1 }]) // failedCount
      .mockResolvedValueOnce([{ age_seconds: 30 }]) // oldestPendingAge
      .mockResolvedValueOnce([{ count: 0 }]); // stuckCount

    const req = new NextRequest('http://localhost:8081/api/admin/server-health');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.data.outbox).toBeDefined();
    expect(json.data.outbox.queueDepth).toBe(14);
    expect(json.data.outbox.processingCount).toBe(2);
    expect(json.data.outbox.failedCount).toBe(1);
    expect(json.data.outbox.stuckCount).toBe(0);
    expect(json.data.outbox.oldestPendingAgeSeconds).toBe(30);
    expect(json.data.outbox.status).toBe('healthy');
  });
});
