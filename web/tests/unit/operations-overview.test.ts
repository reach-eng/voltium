import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { ROLE_PERMISSIONS } from '@/lib/permissions-roles';
import { hasPermission } from '@/lib/permissions';

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  rentalLeaseCount: vi.fn(),
  kycProfileCount: vi.fn(),
  depositRecordCount: vi.fn(),
  vehicleCount: vi.fn(),
  supportTicketCount: vi.fn(),
}));

vi.mock('@/lib/get-session', () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/lib/db', () => ({
  db: {
    rentalLease: { count: mocks.rentalLeaseCount },
    kycProfile: { count: mocks.kycProfileCount },
    depositRecord: { count: mocks.depositRecordCount },
    vehicle: { count: mocks.vehicleCount },
    supportTicket: { count: mocks.supportTicketCount },
  },
}));

vi.mock('@/lib/cache', () => ({
  getOrSetResponse: vi.fn((_key, fetcher) => fetcher()),
  invalidateCache: vi.fn(),
}));

import { GET } from '@/app/api/admin/operations/overview/route';

describe('PR-TL-2 Operations Overview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Permission definition (ops_read)', () => {
    it('defines ops_read permission with correct roles', () => {
      expect(ROLE_PERMISSIONS['ops_read']).toEqual([
        'OPERATIONS_ADMIN',
        'HUB_MANAGER',
        'FLEET_MANAGER',
        'TEAM_LEADER',
        'SUPER_ADMIN',
      ]);
    });

    it('validates role permissions via hasPermission', () => {
      expect(hasPermission('OPERATIONS_ADMIN', 'ops_read')).toBe(true);
      expect(hasPermission('HUB_MANAGER', 'ops_read')).toBe(true);
      expect(hasPermission('FLEET_MANAGER', 'ops_read')).toBe(true);
      expect(hasPermission('TEAM_LEADER', 'ops_read')).toBe(true);
      expect(hasPermission('SUPER_ADMIN', 'ops_read')).toBe(true);

      expect(hasPermission('READ_ONLY', 'ops_read')).toBe(false);
      expect(hasPermission('KYC_REVIEWER', 'ops_read')).toBe(false);
      expect(hasPermission('SUPPORT_AGENT', 'ops_read')).toBe(false);
    });
  });

  describe('GET /api/admin/operations/overview', () => {
    it('returns 401 when unauthenticated', async () => {
      mocks.getAdminSession.mockResolvedValue(null);

      const req = new NextRequest('http://localhost/api/admin/operations/overview');
      const res = await GET(req);

      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('returns 403 when admin lacks ops_read permission', async () => {
      mocks.getAdminSession.mockResolvedValue({
        adminId: 'admin-1',
        adminRole: 'READ_ONLY',
      });

      const req = new NextRequest('http://localhost/api/admin/operations/overview');
      const res = await GET(req);

      expect(res.status).toBe(403);
      const json = await res.json();
      expect(json.success).toBe(false);
    });

    it('returns operations overview metrics for authorized admin with 30s cache header', async () => {
      mocks.getAdminSession.mockResolvedValue({
        adminId: 'admin-1',
        adminRole: 'OPERATIONS_ADMIN',
      });

      mocks.rentalLeaseCount.mockResolvedValue(12);
      mocks.kycProfileCount.mockResolvedValue(4);
      mocks.depositRecordCount.mockResolvedValue(2);
      mocks.vehicleCount.mockResolvedValue(15);
      mocks.supportTicketCount.mockResolvedValue(3);

      const req = new NextRequest('http://localhost/api/admin/operations/overview');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toContain('max-age=30');

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        activeRentals: 12,
        pendingKyc: 4,
        pendingDeposits: 2,
        availableVehicles: 15,
        openTickets: 3,
      });
    });

    it('bypasses cache header (max-age=0) when ?realtime=true is passed', async () => {
      mocks.getAdminSession.mockResolvedValue({
        adminId: 'admin-1',
        adminRole: 'TEAM_LEADER',
      });

      mocks.rentalLeaseCount.mockResolvedValue(5);
      mocks.kycProfileCount.mockResolvedValue(1);
      mocks.depositRecordCount.mockResolvedValue(0);
      mocks.vehicleCount.mockResolvedValue(8);
      mocks.supportTicketCount.mockResolvedValue(0);

      const req = new NextRequest('http://localhost/api/admin/operations/overview?realtime=true');
      const res = await GET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get('Cache-Control')).toContain('max-age=0');

      const json = await res.json();
      expect(json.success).toBe(true);
      expect(json.data).toEqual({
        activeRentals: 5,
        pendingKyc: 1,
        pendingDeposits: 0,
        availableVehicles: 8,
        openTickets: 0,
      });
    });
  });
});
