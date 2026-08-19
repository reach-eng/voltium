import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  db: {
    reconciliationReport: { findMany: vi.fn() },
    systemSetting: { findMany: vi.fn() },
  },
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));
vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    }),
}));
vi.mock('@/lib/permissions', () => ({ hasPermission: mocks.hasPermission }));

import { GET } from '@/app/api/admin/jobs/route';

describe('GET /api/admin/jobs jobs_view Permission Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects GET /api/admin/jobs when admin lacks jobs_view permission', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'read_only_1', adminRole: 'READ_ONLY' });
    mocks.hasPermission.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/jobs', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(403);
    expect(mocks.hasPermission).toHaveBeenCalledWith('READ_ONLY', 'jobs_view');
  });

  it('allows GET /api/admin/jobs when admin has jobs_view permission', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'ops_1', adminRole: 'OPERATIONS_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.db.reconciliationReport.findMany.mockResolvedValue([]);
    mocks.db.systemSetting.findMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/admin/jobs', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});
