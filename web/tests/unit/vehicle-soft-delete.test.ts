import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  retireVehicle: vi.fn(),
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
vi.mock('@/server/modules/vehicles/vehicle.use-cases', () => ({
  vehicleUseCases: {
    retireVehicle: mocks.retireVehicle,
  },
}));

import { DELETE } from '@/app/api/admin/vehicles/route';

describe('Vehicle Soft-Delete Semantics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'SUPER_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
    mocks.retireVehicle.mockResolvedValue({ id: 'vh_1', status: 'RETIRED' });
  });

  it('DELETE /api/admin/vehicles updates status to RETIRED and returns Vehicle retired message', async () => {
    const req = new NextRequest('http://localhost/api/admin/vehicles?id=vh_1', { method: 'DELETE' });
    const res = await DELETE(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.message).toBe('Vehicle retired');
    expect(mocks.retireVehicle).toHaveBeenCalledWith('vh_1', 'admin_1');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:vehicles:*');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('vehicles_list:*');
  });
});
