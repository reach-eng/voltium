import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  adminForbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
  hasPermission: vi.fn(),
  txTeamLeaderUpdate: vi.fn(),
  txTeamLeaderUpdateMany: vi.fn(),
  createAuditLog: vi.fn(),
  invalidateCache: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
  canManageTeamLeaders: vi.fn(() => true),
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn(async (cb) => {
      return cb({
        teamLeader: {
          update: mocks.txTeamLeaderUpdate,
          updateMany: mocks.txTeamLeaderUpdateMany,
        },
      });
    }),
  },
}));

import { POST as undoBulkAction } from '@/app/api/admin/team-leaders/bulk/undo/route';

describe('P1-2: Safe Bulk Undo Semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('does NOT clear deletedAt when undoing activate/deactivate actions', async () => {
    const req = new NextRequest('http://localhost:8081/api/admin/team-leaders/bulk/undo', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: 'tl_1', isActive: false }],
        action: 'activate',
      }),
    });
    const res = await undoBulkAction(req);
    expect(res.status).toBe(200);
    // Should update isActive with deletedAt: null filter, NOT resurrecting deleted rows
    expect(mocks.txTeamLeaderUpdateMany).toHaveBeenCalledWith({
      where: { id: 'tl_1', deletedAt: null },
      data: { isActive: false },
    });
  });

  it('restores deletedAt: null when explicitly undoing a delete action', async () => {
    const req = new NextRequest('http://localhost:8081/api/admin/team-leaders/bulk/undo', {
      method: 'POST',
      body: JSON.stringify({
        items: [{ id: 'tl_1', isActive: true }],
        action: 'delete',
      }),
    });
    const res = await undoBulkAction(req);
    expect(res.status).toBe(200);
    expect(mocks.txTeamLeaderUpdate).toHaveBeenCalledWith({
      where: { id: 'tl_1' },
      data: { isActive: true, deletedAt: null },
    });
  });
});
