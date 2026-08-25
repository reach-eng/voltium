import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  adminForbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
  hasPermission: vi.fn(),
  teamLeaderFindUnique: vi.fn(),
  riderFindMany: vi.fn(),
  walletFindMany: vi.fn(),
  rentalLeaseFindMany: vi.fn(),
  bulkActivate: vi.fn(),
  bulkDeactivate: vi.fn(),
  bulkDelete: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

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
    teamLeader: {
      findUnique: mocks.teamLeaderFindUnique,
    },
    rider: {
      findMany: mocks.riderFindMany,
    },
    wallet: {
      findMany: mocks.walletFindMany,
    },
    rentalLease: {
      findMany: mocks.rentalLeaseFindMany,
    },
  },
}));

vi.mock('@/server/modules/team-leaders/team-leader.use-cases', () => ({
  teamLeaderUseCases: {
    bulkActivate: mocks.bulkActivate,
    bulkDeactivate: mocks.bulkDeactivate,
    bulkDelete: mocks.bulkDelete,
  },
}));

import { GET as getRiders } from '@/app/api/admin/team-leaders/[id]/riders/route';
import { POST as bulkAction } from '@/app/api/admin/team-leaders/bulk/route';

describe('PR-TL-1: Team Leaders P0 Fixes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
  });

  describe('GET /api/admin/team-leaders/[id]/riders', () => {
    it('uses db.rentalLease, queries rider by teamLeader.name without hubId, and calculates balanceInPaise & overdue status correctly', async () => {
      mocks.teamLeaderFindUnique.mockResolvedValue({ id: 'tl_123', name: 'Leader Alpha' });
      mocks.riderFindMany.mockResolvedValue([
        { id: 'r_1', riderId: 'VF-001', fullName: 'Rider 1', phone: '111', lifecycleStatus: 'ACTIVE' },
      ]);
      mocks.walletFindMany.mockResolvedValue([
        { riderId: 'r_1', balanceInPaise: -60000 },
      ]);
      mocks.rentalLeaseFindMany.mockResolvedValue([
        { riderId: 'r_1', status: 'OVERDUE', nextRentDueAt: null, finalPriceInPaise: 150000 },
      ]);

      const req = new NextRequest('http://localhost/api/admin/team-leaders/tl_123/riders');
      const res = await getRiders(req, { params: Promise.resolve({ id: 'tl_123' }) });
      const data = await res.json();

      expect(res.status).toBe(200);

      // Verify relation lookup filter uses teamLeaderId: id
      expect(mocks.riderFindMany).toHaveBeenCalledWith({
        where: { teamLeaderId: 'tl_123' },
        select: {
          id: true,
          riderId: true,
          fullName: true,
          phone: true,
          lifecycleStatus: true,
        },
      });

      // Verify hubId was excluded from select
      const selectObj = mocks.riderFindMany.mock.calls[0][0].select;
      expect(selectObj).not.toHaveProperty('hubId');

      // Verify rentalLease.findMany was called (not rental.findMany)
      expect(mocks.rentalLeaseFindMany).toHaveBeenCalledWith({
        where: { riderId: { in: ['r_1'] } },
        select: { riderId: true, status: true, nextRentDueAt: true, finalPriceInPaise: true },
      });

      // Verify wallet.findMany selected balanceInPaise
      expect(mocks.walletFindMany).toHaveBeenCalledWith({
        where: { riderId: { in: ['r_1'] } },
        select: { riderId: true, balanceInPaise: true },
      });

      // Verify enriched stats & rider response
      expect(data.data.stats).toEqual({
        totalRiders: 1,
        churned: 0,
        overdueRent: 1,
        upcomingRent: 0,
        timelyRent: 0,
        overdueScooter: 1,
      });

      expect(data.data.riders[0]).toMatchObject({
        id: 'r_1',
        // PR-RUPEES-2026-08-08: `balance` is exposed in rupees.
        // Was -60000 paise (₹-600.00) before; now -600 rupees.
        balance: -600,
        isOverdue: true,
        isTimely: false,
        hasOverdueScooter: true,
      });
    });

    it('correctly calculates thresholds for OVERDUE_BALANCE_PAISE (-50000) and HEALTHY_BALANCE_PAISE (0)', async () => {
      mocks.teamLeaderFindUnique.mockResolvedValue({ id: 'tl_123', name: 'Leader Alpha' });
      mocks.riderFindMany.mockResolvedValue([
        { id: 'r_overdue', riderId: 'VF-001', fullName: 'Rider 1', phone: '111', lifecycleStatus: 'ACTIVE' },
        { id: 'r_upcoming', riderId: 'VF-002', fullName: 'Rider 2', phone: '222', lifecycleStatus: 'ACTIVE' },
        { id: 'r_timely', riderId: 'VF-003', fullName: 'Rider 3', phone: '333', lifecycleStatus: 'ACTIVE' },
        { id: 'r_zero', riderId: 'VF-004', fullName: 'Rider 4', phone: '444', lifecycleStatus: 'ACTIVE' },
      ]);
      mocks.walletFindMany.mockResolvedValue([
        { riderId: 'r_overdue', balanceInPaise: -50001 },
        { riderId: 'r_upcoming', balanceInPaise: -50000 },
        { riderId: 'r_timely', balanceInPaise: 100 },
        { riderId: 'r_zero', balanceInPaise: 0 },
      ]);
      mocks.rentalLeaseFindMany.mockResolvedValue([]);

      const req = new NextRequest('http://localhost/api/admin/team-leaders/tl_123/riders');
      const res = await getRiders(req, { params: Promise.resolve({ id: 'tl_123' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.stats).toEqual({
        totalRiders: 4,
        churned: 0,
        overdueRent: 1,
        upcomingRent: 1,
        timelyRent: 2,
        overdueScooter: 0,
      });
    });

    it('dynamically calculates overdue scooter when nextRentDueAt is in the past', async () => {
      const pastDate = new Date(Date.now() - 86400000); // 1 day ago
      mocks.teamLeaderFindUnique.mockResolvedValue({ id: 'tl_123', name: 'Leader Alpha' });
      mocks.riderFindMany.mockResolvedValue([
        { id: 'r_past', riderId: 'VF-001', fullName: 'Rider 1', phone: '111', lifecycleStatus: 'ACTIVE' },
      ]);
      mocks.walletFindMany.mockResolvedValue([
        { riderId: 'r_past', balanceInPaise: 0 },
      ]);
      mocks.rentalLeaseFindMany.mockResolvedValue([
        { riderId: 'r_past', status: 'BOOKED', nextRentDueAt: pastDate, finalPriceInPaise: 200000 },
      ]);

      const req = new NextRequest('http://localhost/api/admin/team-leaders/tl_123/riders');
      const res = await getRiders(req, { params: Promise.resolve({ id: 'tl_123' }) });
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.data.stats.overdueScooter).toBe(1);
      expect(data.data.riders[0].hasOverdueScooter).toBe(true);
    });

    it('returns 404 if team leader is not found', async () => {
      mocks.teamLeaderFindUnique.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/admin/team-leaders/nonexistent/riders');
      const res = await getRiders(req, { params: Promise.resolve({ id: 'nonexistent' }) });

      expect(res.status).toBe(404);
    });

    it('returns 403 if admin lacks riders_view permission', async () => {
      mocks.hasPermission.mockReturnValue(false);

      const req = new NextRequest('http://localhost/api/admin/team-leaders/tl_123/riders');
      const res = await getRiders(req, { params: Promise.resolve({ id: 'tl_123' }) });

      expect(res.status).toBe(403);
      // AUDIT FIX (N-5): the route now uses the SESSION-OBJECT form so explicit
      // adminPermissions grants/revocations are honored (was: bare role string).
      expect(mocks.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' }),
        'riders_view'
      );
    });
  });

  describe('POST /api/admin/team-leaders/bulk', () => {
    it('checks team_leaders_manage permission (canonical key, PR-1)', async () => {
      mocks.bulkActivate.mockResolvedValue(2);

      const req = new NextRequest('http://localhost/api/admin/team-leaders/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: ['tl_1', 'tl_2'], action: 'activate' }),
      });

      const res = await bulkAction(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(mocks.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' }),
        'team_leaders_manage'
      );
      expect(mocks.bulkActivate).toHaveBeenCalledWith(['tl_1', 'tl_2'], 'admin_1');
      expect(data.data.count).toBe(2);
    });

    it('returns 403 when team_leaders_manage permission is lacking', async () => {
      mocks.hasPermission.mockReturnValue(false);

      const req = new NextRequest('http://localhost/api/admin/team-leaders/bulk', {
        method: 'POST',
        body: JSON.stringify({ ids: ['tl_1'], action: 'deactivate' }),
      });

      const res = await bulkAction(req);

      expect(res.status).toBe(403);
      expect(mocks.hasPermission).toHaveBeenCalledWith(
        expect.objectContaining({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' }),
        'team_leaders_manage'
      );
      expect(mocks.bulkDeactivate).not.toHaveBeenCalled();
    });
  });
});
