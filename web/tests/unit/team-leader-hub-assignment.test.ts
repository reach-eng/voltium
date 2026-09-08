import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  adminUnauthorized: vi.fn(() => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })),
  adminForbidden: vi.fn(() => new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 })),
  hasPermission: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  listAdminHubs: vi.fn(),
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

vi.mock('@/server/modules/team-leaders/team-leader.use-cases', () => ({
  teamLeaderUseCases: {
    list: mocks.list,
    create: mocks.create,
    update: mocks.update,
  },
}));

vi.mock('@/server/modules/hubs/hub.use-cases', () => ({
  hubUseCases: {
    listAdminHubs: mocks.listAdminHubs,
  },
}));

import { GET as getTeamLeaders, POST as createTeamLeader, PUT as updateTeamLeader } from '@/app/api/admin/team-leaders/route';
import { GET as getHubs } from '@/app/api/admin/hubs/route';

describe('P0-1: Team Leader Hub Assignment and Filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'OPERATIONS_ADMIN' });
    mocks.hasPermission.mockImplementation((role, perm) => {
      if (perm === 'team_leaders_manage' || perm === 'hubs_manage') return true;
      return false;
    });
  });

  it('filters team leaders by hubId when provided in query params', async () => {
    mocks.list.mockResolvedValue({ leaders: [], pagination: { total: 0 } });
    const req = new NextRequest('http://localhost:8081/api/admin/team-leaders?hubId=hub_123&page=1&limit=20');
    const res = await getTeamLeaders(req);
    expect(res.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(
      expect.objectContaining({ hubId: 'hub_123', page: 1, limit: 20 })
    );
  });

  it('allows team leader creation with an assigned hubId', async () => {
    mocks.create.mockResolvedValue({ id: 'tl_1', name: 'John TL', hubId: 'hub_123' });
    const req = new NextRequest('http://localhost:8081/api/admin/team-leaders', {
      method: 'POST',
      body: JSON.stringify({
        name: 'John TL',
        phone: '9876543210',
        hubId: 'hub_123',
      }),
    });
    const res = await createTeamLeader(req);
    expect(res.status).toBe(201);
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'John TL', phone: '9876543210', hubId: 'hub_123' }),
      'admin_1'
    );
  });

  it('allows hubs GET endpoint access for team leader managers', async () => {
    mocks.listAdminHubs.mockResolvedValue({ hubs: [{ id: 'hub_1', name: 'North Hub' }], total: 1 });
    // User has team_leaders_manage but not hubs_manage
    mocks.hasPermission.mockImplementation((role, perm) => perm === 'team_leaders_manage');
    const req = new NextRequest('http://localhost:8081/api/admin/hubs?limit=100');
    const res = await getHubs(req);
    expect(res.status).toBe(200);
  });
});
