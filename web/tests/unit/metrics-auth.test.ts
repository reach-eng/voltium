import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getMetrics: vi.fn(),
  getSlowQueries: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));
vi.mock('@/lib/apm', () => ({
  getMetrics: mocks.getMetrics,
  getSlowQueries: mocks.getSlowQueries,
}));

import { GET } from '@/app/api/metrics/route';

function makeRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest(url, { method: 'GET', headers });
}

describe('Prometheus Metrics Endpoint Auth Hardening', () => {
  const originalToken = process.env.INTERNAL_METRICS_TOKEN;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.INTERNAL_METRICS_TOKEN = 'secret-metrics-token-123';
  });

  afterEach(() => {
    process.env.INTERNAL_METRICS_TOKEN = originalToken;
  });

  it('rejects unauthenticated requests with 401 when no token or admin session present', async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await GET(makeRequest('http://localhost/api/metrics'));
    expect(res.status).toBe(401);
  });

  it('allows access via x-internal-metrics-token header', async () => {
    mocks.requireAdmin.mockResolvedValue(null);

    const res = await GET(
      makeRequest('http://localhost/api/metrics', {
        'x-internal-metrics-token': 'secret-metrics-token-123',
      })
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('process_cpu_seconds_total');
  });

  it('allows access via valid admin session fallback', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin-1', adminRole: 'SUPER_ADMIN' });

    const res = await GET(makeRequest('http://localhost/api/metrics'));
    expect(res.status).toBe(200);
  });

  it('allows authenticated JSON metric access', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin-1', adminRole: 'SUPER_ADMIN' });
    mocks.getMetrics.mockReturnValue({ heapUsedMb: 42 });

    const res = await GET(makeRequest('http://localhost/api/metrics?format=json'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.heapUsedMb).toBe(42);
  });
});
