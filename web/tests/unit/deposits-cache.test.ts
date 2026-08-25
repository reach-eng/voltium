import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  reviewDeposit: vi.fn(),
  logAdminAction: vi.fn().mockResolvedValue(undefined),
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
vi.mock('@/server/modules/admin/admin.policy', () => ({ logAdminAction: mocks.logAdminAction }));
vi.mock('@/server/modules/deposits/deposit.use-cases', () => ({
  depositUseCases: {
    reviewDeposit: mocks.reviewDeposit,
  },
}));

import { PUT } from '@/app/api/admin/deposits/route';

describe('Deposit Actions Cache Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'SUPER_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.reviewDeposit.mockResolvedValue({ status: 'APPROVED' });
  });

  it('PUT /api/admin/deposits invalidates deposits and admin caches on approve', async () => {
    const req = new NextRequest('http://localhost/api/admin/deposits', {
      method: 'PUT',
      body: JSON.stringify({ riderId: 'r_1', action: 'APPROVE' }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:deposits:*');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:wallets:*');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:riders:*');
  });
});
