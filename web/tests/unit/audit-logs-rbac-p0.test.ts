/**
 * TG-3 (2026-08-05 ops audit) — audit-logs GET is gated by audit_view.
 *
 * Previously the route only called requireAdmin() — every admin (including
 * READ_ONLY) could enumerate the actor graph, rider entityIds, and financial
 * events. This test uses the REAL hasPermission + ROLE_PERMISSIONS matrix
 * (only '@/lib/rbac' and the admin use-case are mocked), so it proves both
 * the route check AND the matrix change (READ_ONLY removed from audit_view).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(),
  adminForbidden: vi.fn(),
  getAuditLogs: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

// IMPORTANT: do NOT mock '@/lib/auth' — the real hasPermission + the real
// ROLE_PERMISSIONS matrix must run so this test catches matrix regressions.
vi.mock('@/server/modules/admin/admin.use-cases', () => ({
  adminUseCases: { getAuditLogs: mocks.getAuditLogs },
}));

import { GET } from '@/app/api/admin/audit-logs/route';

function makeRequest(): NextRequest {
  return new NextRequest('http://localhost/api/admin/audit-logs');
}

describe('TG-3: audit-logs GET permission check', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.adminUnauthorized.mockReturnValue(new Response('unauthorized', { status: 401 }));
    mocks.adminForbidden.mockReturnValue(new Response('forbidden', { status: 403 }));
    mocks.getAuditLogs.mockResolvedValue({
      logs: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
    });
  });

  it('returns 403 for a READ_ONLY admin (matrix excludes READ_ONLY from audit_view)', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'ro_1', adminRole: 'READ_ONLY' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    expect(mocks.getAuditLogs).not.toHaveBeenCalled();
  });

  it('returns 403 for SUPPORT_AGENT (not granted audit_view)', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'sa_1', adminRole: 'SUPPORT_AGENT' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it('allows OPERATIONS_ADMIN (granted audit_view)', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'oa_1', adminRole: 'OPERATIONS_ADMIN' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mocks.getAuditLogs).toHaveBeenCalled();
  });

  it('allows FINANCE_ADMIN (granted audit_view)', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'fa_1', adminRole: 'FINANCE_ADMIN' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('SUPER_ADMIN is implicitly allowed', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'sa_2', adminRole: 'SUPER_ADMIN' });
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it('unauthenticated returns 401', async () => {
    mocks.requireAdmin.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });
});
