import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  adminForbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
  hasPermission: vi.fn(),
  teamLeaderFindUnique: vi.fn(),
  riderFindMany: vi.fn(),
  riderCount: vi.fn(),
  walletFindMany: vi.fn(),
  rentalLeaseFindMany: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: mocks.adminUnauthorized,
  adminForbidden: mocks.adminForbidden,
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/db', () => ({
  db: {
    teamLeader: { findUnique: mocks.teamLeaderFindUnique },
    rider: { findMany: mocks.riderFindMany, count: mocks.riderCount },
    wallet: { findMany: mocks.walletFindMany },
    rentalLease: { findMany: mocks.rentalLeaseFindMany },
  },
}));

import { GET as getRiders } from '@/app/api/admin/team-leaders/[id]/riders/route';

describe('P1-4 & P1-5: Team Leader Riders Endpoint Bounding', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('bounds rider findMany query with take: 100 and uses count for total', async () => {
    mocks.teamLeaderFindUnique.mockResolvedValue({ id: 'tl_1', name: 'Leader' });
    mocks.riderFindMany.mockResolvedValue([]);
    mocks.riderCount.mockResolvedValue(42);
    mocks.walletFindMany.mockResolvedValue([]);
    mocks.rentalLeaseFindMany.mockResolvedValue([]);

    const req = new NextRequest('http://localhost:8081/api/admin/team-leaders/tl_1/riders');
    const res = await getRiders(req, { params: Promise.resolve({ id: 'tl_1' }) });
    expect(res.status).toBe(200);

    expect(mocks.riderFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { teamLeaderId: 'tl_1' },
        take: 100,
      })
    );
    expect(mocks.riderCount).toHaveBeenCalledWith({
      where: { teamLeaderId: 'tl_1' },
    });
    const json = await res.json();
    expect(json.data.stats.totalRiders).toBe(42);
  });
});
