import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTeamLeaderSchema } from '@/lib/validators';
import { canManageTeamLeaders } from '@/lib/rbac';
import { buildTeamLeaderCsv } from '@/components/admin/screens/team-leaders/exportTeamLeaders';
import { teamLeaderUseCases, TeamLeaderStateError } from '@/server/modules/team-leaders/team-leader.use-cases';
import { teamLeaderRepository } from '@/server/modules/team-leaders/team-leader.repository';
import { db } from '@/lib/db';
import * as cacheModule from '@/lib/cache';
import * as teamLeadersRoute from '@/app/api/admin/team-leaders/route';
import * as teamLeadersBulkRoute from '@/app/api/admin/team-leaders/bulk/route';
import { NextRequest } from 'next/server';

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      count: vi.fn(),
    },
    teamLeader: {
      update: vi.fn(),
      updateMany: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/server/modules/team-leaders/team-leader.repository', () => ({
  teamLeaderRepository: {
    delete: vi.fn(),
    bulkDelete: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findAllPaginated: vi.fn(),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/rbac', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rbac')>();
  return {
    ...actual,
    requireAdmin: vi.fn().mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' }),
  };
});

describe('P2 Hardening: RBAC, Phone, CSV, and FK Delete Guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('canManageTeamLeaders accepts canonical team_leaders_manage or legacy tl_manage', () => {
    expect(canManageTeamLeaders('OPERATIONS_ADMIN')).toBe(true);
    expect(canManageTeamLeaders('VIEWER')).toBe(false);
  });

  it('normalizes phone numbers with +91, spaces, dashes, and leading 0 in createTeamLeaderSchema', () => {
    const res1 = createTeamLeaderSchema.safeParse({
      name: 'Test Leader',
      phone: '+91 98765-43210',
    });
    expect(res1.success).toBe(true);
    if (res1.success) {
      expect(res1.data.phone).toBe('9876543210');
    }

    const res2 = createTeamLeaderSchema.safeParse({
      name: 'Test Leader 2',
      phone: '09876543210',
    });
    expect(res2.success).toBe(true);
    if (res2.success) {
      expect(res2.data.phone).toBe('9876543210');
    }

    const res3 = createTeamLeaderSchema.safeParse({
      name: 'Test Leader 3',
      phone: '12345',
    });
    expect(res3.success).toBe(false);
  });

  it('includes Hub in exported CSV headers and data rows', () => {
    const csv = buildTeamLeaderCsv([
      {
        id: 'tl_1',
        name: 'Leader 1',
        phone: '9876543210',
        email: 'l1@example.com',
        hub: { id: 'hub_1', name: 'Downtown Hub' },
        isActive: true,
        createdAt: '2026-09-01T00:00:00Z',
        riderCount: 5,
      },
      {
        id: 'tl_2',
        name: 'Leader 2',
        phone: '9876543211',
        email: 'l2@example.com',
        hub: null,
        isActive: false,
        createdAt: '2026-09-02T00:00:00Z',
        riderCount: 0,
      },
    ]);
    expect(csv).toContain('"Hub"');
    expect(csv).toContain('"Downtown Hub"');
    expect(csv).toContain('"Unassigned"');
  });

  it('delete throws TeamLeaderStateError when active riders are assigned', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(3);

    await expect(teamLeaderUseCases.delete('tl_1', 'admin_1')).rejects.toThrow(TeamLeaderStateError);
    expect(teamLeaderRepository.delete).not.toHaveBeenCalled();
  });

  it('delete proceeds when no active riders are assigned', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(0);
    vi.mocked(teamLeaderRepository.delete).mockResolvedValue({} as any);

    await teamLeaderUseCases.delete('tl_1', 'admin_1');
    expect(teamLeaderRepository.delete).toHaveBeenCalledWith('tl_1');
  });

  it('bulkDelete throws TeamLeaderStateError when active riders are assigned', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(2);

    await expect(teamLeaderUseCases.bulkDelete(['tl_1', 'tl_2'], 'admin_1')).rejects.toThrow(
      TeamLeaderStateError
    );
    expect(teamLeaderRepository.bulkDelete).not.toHaveBeenCalled();
  });

  it('bulkDelete proceeds when no active riders are assigned', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(0);
    vi.mocked(teamLeaderRepository.bulkDelete).mockResolvedValue(2);

    const count = await teamLeaderUseCases.bulkDelete(['tl_1', 'tl_2'], 'admin_1');
    expect(count).toBe(2);
    expect(teamLeaderRepository.bulkDelete).toHaveBeenCalledWith(['tl_1', 'tl_2']);
  });

  it('DELETE route returns 409 Conflict when team leader has active riders', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(1);

    const req = new NextRequest('http://localhost/api/admin/team-leaders', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'tl_with_riders' }),
    });

    const res = await teamLeadersRoute.DELETE(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.message).toContain('active rider(s) are currently assigned');
  });

  it('DELETE route invalidates cache on successful deletion', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(0);
    vi.mocked(teamLeaderRepository.delete).mockResolvedValue({} as any);
    const invalidateSpy = vi.spyOn(cacheModule, 'invalidateCache');

    const req = new NextRequest('http://localhost/api/admin/team-leaders', {
      method: 'DELETE',
      body: JSON.stringify({ id: 'tl_safe' }),
    });

    const res = await teamLeadersRoute.DELETE(req);
    expect(res.status).toBe(200);
    expect(invalidateSpy).toHaveBeenCalledWith('admin:team-leaders:*');
  });

  it('POST bulk delete returns 409 Conflict when active riders exist', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(2);

    const req = new NextRequest('http://localhost/api/admin/team-leaders/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: ['tl_1', 'tl_2'], action: 'delete' }),
    });

    const res = await teamLeadersBulkRoute.POST(req);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.message).toContain('active rider(s) are currently assigned');
  });

  it('POST bulk delete invalidates cache on success', async () => {
    vi.mocked(db.rider.count).mockResolvedValue(0);
    vi.mocked(teamLeaderRepository.bulkDelete).mockResolvedValue(2);
    const invalidateSpy = vi.spyOn(cacheModule, 'invalidateCache');

    const req = new NextRequest('http://localhost/api/admin/team-leaders/bulk', {
      method: 'POST',
      body: JSON.stringify({ ids: ['tl_1', 'tl_2'], action: 'delete' }),
    });

    const res = await teamLeadersBulkRoute.POST(req);
    expect(res.status).toBe(200);
    expect(invalidateSpy).toHaveBeenCalledWith('admin:team-leaders:*');
  });
});
