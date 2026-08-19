import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  getOrSetResponse: vi.fn(),
  findLeaseById: vi.fn(),
  executeLeaseAction: vi.fn(),
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
vi.mock('@/lib/cache', () => ({
  getOrSetResponse: mocks.getOrSetResponse,
  invalidateCache: mocks.invalidateCache,
}));
vi.mock('@/server/modules/rentals/rental.repository', () => ({
  rentalRepository: {
    findManyLeases: vi.fn(),
    countLeases: vi.fn(),
    findLeaseById: mocks.findLeaseById,
    executeLeaseAction: mocks.executeLeaseAction,
  },
}));

import { GET, PUT } from '@/app/api/admin/rentals/route';

describe('Rentals Admin Route Permission Matrix', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('allows GET /api/admin/rentals for users with rentals_pickup_inspection', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'fleet_mgr', adminRole: 'FLEET_MANAGER' });
    mocks.hasPermission.mockImplementation((role, perm) => perm === 'rentals_pickup_inspection');
    mocks.getOrSetResponse.mockResolvedValue({ records: [], pagination: { total: 0 } });

    const req = new NextRequest('http://localhost/api/admin/rentals', { method: 'GET' });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it('correctly maps PUT /api/admin/rentals action START to rentals_pickup_inspection', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'fleet_mgr', adminRole: 'FLEET_MANAGER' });
    mocks.hasPermission.mockImplementation((role, perm) => perm === 'rentals_pickup_inspection');
    mocks.findLeaseById.mockResolvedValue({ id: 'lease_1', status: 'BOOKED' });
    mocks.executeLeaseAction.mockResolvedValue({ id: 'lease_1', status: 'ACTIVE' });

    const req = new NextRequest('http://localhost/api/admin/rentals', {
      method: 'PUT',
      body: JSON.stringify({ leaseId: 'lease_1', action: 'START' }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mocks.hasPermission).toHaveBeenCalledWith('FLEET_MANAGER', 'rentals_pickup_inspection');
  });

  it('correctly maps PUT /api/admin/rentals action APPROVE_RETURN to rentals_return_inspection', async () => {
    mocks.requireAdmin.mockResolvedValue({ adminId: 'fleet_mgr', adminRole: 'FLEET_MANAGER' });
    mocks.hasPermission.mockImplementation((role, perm) => perm === 'rentals_return_inspection');
    mocks.findLeaseById.mockResolvedValue({ id: 'lease_1', status: 'RETURN_PENDING' });
    mocks.executeLeaseAction.mockResolvedValue({ id: 'lease_1', status: 'COMPLETED' });

    const req = new NextRequest('http://localhost/api/admin/rentals', {
      method: 'PUT',
      body: JSON.stringify({ leaseId: 'lease_1', action: 'APPROVE_RETURN' }),
    });

    const res = await PUT(req);
    expect(res.status).toBe(200);
    expect(mocks.hasPermission).toHaveBeenCalledWith('FLEET_MANAGER', 'rentals_return_inspection');
  });
});
