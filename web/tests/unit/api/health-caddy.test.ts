import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const mockAuth = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: () =>
    new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  requireCronAuth: () => null,
}));

const originalFetch = global.fetch;

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mockAuth.requireAdmin,
  adminUnauthorized: mockAuth.adminUnauthorized,
}));
vi.mock('@/lib/cron-auth', () => ({
  requireCronAuth: mockAuth.requireCronAuth,
}));

const { GET } = await import('@/app/api/health/caddy/route');

const makeReq = () => new NextRequest('http://localhost/api/health/caddy');

describe('GET /api/health/caddy — fail-loud default + 10s cache (P2-5b)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.requireAdmin.mockResolvedValue({ adminId: 'admin-1', adminRole: 'SUPER_ADMIN' });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('returns Active when the Caddy admin endpoint answers 200', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe('Active');
  });

  it('returns Active when the Caddy admin endpoint answers 401 (auth required = alive)', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 401 } as Response);
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.data.status).toBe('Active');
  });

  it('returns Offline when the fetch rejects (Caddy not running)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.data.status).toBe('Offline');
  });

  it('sets a 10s private cache on the response', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    const res = await GET(makeReq());
    const cacheControl = res.headers.get('Cache-Control');
    expect(cacheControl).toContain('private');
    expect(cacheControl).toContain('max-age=10');
    expect(cacheControl).toContain('must-revalidate');
  });

  it('sets Vary: Authorization so cached responses are per-admin', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response);
    const res = await GET(makeReq());
    expect(res.headers.get('Vary')).toBe('Authorization');
  });
});
