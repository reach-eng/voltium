import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getMetrics: vi.fn().mockReturnValue({ cpu: 10, memory: 200 }),
  getSlowQueries: vi.fn().mockReturnValue([]),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
}));

vi.mock('@/lib/apm', () => ({
  getMetrics: mocks.getMetrics,
  getSlowQueries: mocks.getSlowQueries,
}));

import { GET } from '@/app/api/metrics/route';

describe('P0-1: /api/metrics endpoint authentication', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv, INTERNAL_METRICS_TOKEN: 'secret-metrics-token-123' };
    mocks.requireAdmin.mockResolvedValue(null);
  });

  it('rejects unauthenticated request with 401 Unauthorized', async () => {
    const req = new NextRequest('http://localhost/api/metrics');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('allows access with x-internal-metrics-token header', async () => {
    const req = new NextRequest('http://localhost/api/metrics?format=json', {
      headers: { 'x-internal-metrics-token': 'secret-metrics-token-123' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });

  it('allows access with Authorization: Bearer token header', async () => {
    const req = new NextRequest('http://localhost/api/metrics?format=json', {
      headers: { authorization: 'Bearer secret-metrics-token-123' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('allows access with query param token', async () => {
    const req = new NextRequest('http://localhost/api/metrics?format=json&token=secret-metrics-token-123');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('allows access for authenticated admin session without token', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'SUPER_ADMIN' });
    const req = new NextRequest('http://localhost/api/metrics?format=json');
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
