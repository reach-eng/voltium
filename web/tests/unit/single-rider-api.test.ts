import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  findFirst: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));
vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

import { GET } from '@/app/api/admin/riders/[id]/route';

describe('Single Rider Detail API Route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ adminId: 'admin_1', adminRole: 'SUPER_ADMIN' });
    mocks.hasPermission.mockReturnValue(true);
  });

  it('returns single rider profile with nested relations', async () => {
    mocks.findFirst.mockResolvedValue({
      id: 'r_1',
      riderId: 'VF-RD-0001',
      fullName: 'John Doe',
      kycProfile: { status: 'APPROVED' },
      wallet: { balance: 500 },
    });

    const req = new NextRequest('http://localhost/api/admin/riders/r_1', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ id: 'r_1' }) });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data.fullName).toBe('John Doe');
    expect(json.data.kycProfile.status).toBe('APPROVED');
  });

  it('returns 404 if rider is not found', async () => {
    mocks.findFirst.mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/admin/riders/non_existent', { method: 'GET' });
    const res = await GET(req, { params: Promise.resolve({ id: 'non_existent' }) });
    expect(res.status).toBe(404);
  });
});
