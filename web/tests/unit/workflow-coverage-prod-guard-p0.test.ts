/**
 * TG (2026-08-05 legal/device audit) — P0-3: /api/admin/workflow-coverage
 * must be dev-only (the UI is dev-only) and gated behind `analytics_view`.
 *
 * Before: the route shipped to production exposing DB/worker health to any
 * admin session, and ran 10 sequential 5s-timeout fetches (50s worst case).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

const ORIGINAL_ENV = { ...process.env };

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  hasPermission: vi.fn(),
  getOrSetResponse: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

vi.mock('@/lib/cache', () => ({ getOrSetResponse: mocks.getOrSetResponse }));

import { GET } from '@/app/api/admin/workflow-coverage/route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/workflow-coverage');
}

async function loadRoute() {
  return GET(makeRequest());
}

afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in ORIGINAL_ENV)) delete process.env[key];
  }
  for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
    process.env[key] = value;
  }
});

describe('P0-3: workflow-coverage is dev-only + analytics_view-gated', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.APP_ENV = 'development';
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.getOrSetResponse.mockResolvedValue({
      workflows: [],
      database: { status: 'green', detail: 'Database connected' },
      workers: { status: 'green', detail: 'Workers healthy' },
      timestamp: new Date().toISOString(),
    });
  });

  it('returns 404 when APP_ENV is production', async () => {
    process.env.APP_ENV = 'production';
    const res = await loadRoute();
    expect(res.status).toBe(404);
    expect(mocks.requireAdmin).not.toHaveBeenCalled();
  });

  it('returns 404 when APP_ENV is staging', async () => {
    process.env.APP_ENV = 'staging';
    const res = await loadRoute();
    expect(res.status).toBe(404);
  });

  it('returns 404 on a plain NODE_ENV=production build (APP_ENV unset)', async () => {
    delete process.env.APP_ENV;
    (process.env as any).NODE_ENV = 'production';
    const res = await loadRoute();
    expect(res.status).toBe(404);
  });

  it('serves the route when APP_ENV is unset (CI/local, no .env committed)', async () => {
    delete process.env.APP_ENV;
    delete (process.env as any).NODE_ENV;
    const res = await loadRoute();
    expect(res.status).toBe(200);
    expect(mocks.requireAdmin).toHaveBeenCalled();
  });

  it('requires an admin session in dev', async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    mocks.adminUnauthorized.mockReturnValue(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
    );
    const res = await loadRoute();
    expect(res.status).toBe(401);
  });

  it('rejects roles without analytics_view with 403', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin_2',
      adminRole: 'SUPPORT_AGENT',
    });
    mocks.hasPermission.mockReturnValue(false);
    mocks.adminForbidden.mockReturnValue(
      new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })
    );
    const res = await loadRoute();
    expect(res.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith('SUPPORT_AGENT', 'analytics_view');
    expect(mocks.getOrSetResponse).not.toHaveBeenCalled();
  });

  it('returns the cached health payload for an analytics_view admin', async () => {
    const res = await loadRoute();
    expect(res.status).toBe(200);
    expect(mocks.getOrSetResponse).toHaveBeenCalledWith(
      'admin:workflow-coverage',
      expect.any(Function),
      30
    );
  });
});
