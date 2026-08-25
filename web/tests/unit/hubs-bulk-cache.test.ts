import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  bulkActivate: vi.fn(),
  invalidateCache: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));
vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));
vi.mock('@/lib/cache', () => ({ invalidateCache: mocks.invalidateCache }));
vi.mock('@/server/modules/hubs/hub.use-cases', () => ({
  hubUseCases: {
    bulkActivate: mocks.bulkActivate,
  },
}));

import { POST } from '@/app/api/admin/hubs/bulk/route';

describe('Hubs Bulk Operations Cache Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'SUPER_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.bulkActivate.mockResolvedValue({ count: 2 });
  });

  it('POST /api/admin/hubs/bulk invalidates admin cache after operation', async () => {
    const req = new NextRequest('http://localhost/api/admin/hubs/bulk', {
      method: 'POST',
      body: JSON.stringify({ action: 'activate', ids: ['hub_1', 'hub_2'] }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:hubs:*');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:vehicles:*');
  });
});
