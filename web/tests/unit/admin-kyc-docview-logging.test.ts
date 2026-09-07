/**
 * NET-005 follow-up-9 (2026-09-08): admin KYC document-view logging.
 *
 * Three live admin routes return KYC document URLs to the admin:
 *   - GET /api/admin/riders           (list — used by both rider-management
 *                                       and kyc-management screens)
 *   - GET /api/admin/riders/[id]      (single-rider detail dialog)
 *   - GET /api/admin/kyc              (KYC review queue)
 *
 * SOC2 requires that every admin access to a rider's KYC data be
 * recorded in the audit log via `logKycDocumentView`. The dead
 * `kycRepository.findByRiderIdForAdmin` (PR-99) was never wired
 * up; the log is now fired at the route level with a
 * `documentType` that distinguishes the three views:
 *   - `riders_list`
 *   - `rider_detail`
 *   - `kyc_queue`
 *
 * What this test asserts:
 *   1. Riders list: one `logKycDocumentView` per rider that has
 *      a non-PENDING kycStatus OR any doc URL set (filters out
 *      PENDING-with-nothing-to-view rows).
 *   2. Single rider: one fire when kycProfile exists; zero when
 *      kycProfile is null.
 *   3. KYC queue: one fire per record that has `rider.id`.
 *   4. documentType matches the route in each case.
 *
 * Pure route-layer test — auth + db + cache + signRiderUrls +
 * kycRepository are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// All mocks live in a single hoisted object so vi.mock factories
// (which vitest hoists to the top of the file) can reference them
// without TDZ errors.
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  // logKycDocumentView — the function under test
  logKycDocumentView: vi.fn().mockResolvedValue(undefined),
  // Riders list
  getAdminSession: vi.fn(),
  listRiders: vi.fn(),
  // Single rider
  requireAdmin: vi.fn(),
  riderFindFirst: vi.fn(),
  hasPermission: vi.fn(),
  // KYC queue
  kycFindMany: vi.fn(),
  kycCount: vi.fn(),
  signRiderUrls: vi.fn((r: unknown) => r),
}));

vi.mock('@/lib/security-events', () => ({
  logKycDocumentView: mocks.logKycDocumentView,
}));

vi.mock('@/lib/get-session', () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
  adminForbiddenWithLog: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/cache', () => ({
  // Fire the inner fn every time so we exercise the log loop.
  getOrSetResponse: vi.fn(async (_key: string, fn: () => unknown) => fn()),
  invalidateCache: vi.fn(),
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: { findFirst: mocks.riderFindFirst },
  },
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrls: mocks.signRiderUrls,
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({
    enableKYCVerification: true,
    enableGuarantorRequirement: true,
  }),
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    list: mocks.listRiders,
  },
}));

vi.mock('@/server/modules/kyc/kyc.repository', () => ({
  kycRepository: {
    findMany: mocks.kycFindMany,
    count: mocks.kycCount,
  },
}));

// Imports must come AFTER all vi.mock declarations so the mocked
// modules are wired up before the route modules evaluate.
import { GET as listRiders } from '@/app/api/admin/riders/route';
import { GET as getSingleRider } from '@/app/api/admin/riders/[id]/route';
import { GET as getKycQueue } from '@/app/api/admin/kyc/route';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('NET-005 follow-up-9: admin KYC document-view logging', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: admin is logged in, has the relevant view permission.
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
  });

  // -----------------------------------------------------------------------
  // Route 1: riders list
  // -----------------------------------------------------------------------
  describe('GET /api/admin/riders (list)', () => {
    it('fires one log per rider with non-PENDING kycStatus', async () => {
      mocks.listRiders.mockResolvedValue({
        riders: [
          { id: 'r1', kycStatus: 'SUBMITTED' },
          { id: 'r2', kycStatus: 'APPROVED' },
          { id: 'r3', kycStatus: 'REJECTED' },
          { id: 'r4', kycStatus: 'PENDING' }, // no row, skipped
          { id: 'r5', kycStatus: 'INFO_REQUIRED' },
        ],
        pagination: { page: 1, limit: 20, total: 5, totalPages: 1, nextCursor: null },
        flags: {},
      });

      const req = new NextRequest('http://localhost/api/admin/riders', { method: 'GET' });
      const res = await listRiders(req);
      expect(res.status).toBe(200);

      // 4 of 5 should be logged (PENDING-default rider has no row).
      expect(mocks.logKycDocumentView).toHaveBeenCalledTimes(4);
      const calledRiderIds = mocks.logKycDocumentView.mock.calls
        .map((c: unknown[]) => (c[0] as { riderId: string }).riderId)
        .sort();
      expect(calledRiderIds).toEqual(['r1', 'r2', 'r3', 'r5']);
    });

    it('also logs PENDING-status riders that have at least one doc URL', async () => {
      // Partial upload: status stays PENDING but aadhaarFront is set.
      mocks.listRiders.mockResolvedValue({
        riders: [
          { id: 'r1', kycStatus: 'PENDING', aadhaarFront: 'https://cdn/a.jpg' },
          { id: 'r2', kycStatus: 'PENDING' }, // truly empty, skipped
        ],
        pagination: { page: 1, limit: 20, total: 2, totalPages: 1, nextCursor: null },
        flags: {},
      });

      const req = new NextRequest('http://localhost/api/admin/riders', { method: 'GET' });
      const res = await listRiders(req);
      expect(res.status).toBe(200);

      expect(mocks.logKycDocumentView).toHaveBeenCalledTimes(1);
      expect(mocks.logKycDocumentView).toHaveBeenCalledWith({
        adminId: 'admin-1',
        riderId: 'r1',
        documentType: 'riders_list',
      });
    });

    it('uses documentType=`riders_list`', async () => {
      mocks.listRiders.mockResolvedValue({
        riders: [{ id: 'r1', kycStatus: 'APPROVED' }],
        pagination: { page: 1, limit: 20, total: 1, totalPages: 1, nextCursor: null },
        flags: {},
      });

      const req = new NextRequest('http://localhost/api/admin/riders', { method: 'GET' });
      await listRiders(req);

      const call = mocks.logKycDocumentView.mock.calls[0]?.[0] as
        | { documentType: string }
        | undefined;
      expect(call?.documentType).toBe('riders_list');
    });

    it('does not log when the use case returns an empty list', async () => {
      mocks.listRiders.mockResolvedValue({
        riders: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0, nextCursor: null },
        flags: {},
      });

      const req = new NextRequest('http://localhost/api/admin/riders', { method: 'GET' });
      await listRiders(req);

      expect(mocks.logKycDocumentView).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Route 2: single rider
  // -----------------------------------------------------------------------
  describe('GET /api/admin/riders/[id] (single)', () => {
    it('fires one log when kycProfile exists', async () => {
      mocks.riderFindFirst.mockResolvedValue({
        id: 'r1',
        riderId: 'VF-RD-0001',
        fullName: 'John',
        kycProfile: { id: 'kp1', status: 'SUBMITTED', aadhaarFront: 'https://cdn/a.jpg' },
        wallet: null,
        guarantor: null,
        leases: [],
      });

      const req = new NextRequest('http://localhost/api/admin/riders/r1', { method: 'GET' });
      const res = await getSingleRider(req, { params: Promise.resolve({ id: 'r1' }) });
      expect(res.status).toBe(200);

      expect(mocks.logKycDocumentView).toHaveBeenCalledTimes(1);
      expect(mocks.logKycDocumentView).toHaveBeenCalledWith({
        adminId: 'admin-1',
        riderId: 'r1',
        documentType: 'rider_detail',
      });
    });

    it('does not log when kycProfile is null', async () => {
      mocks.riderFindFirst.mockResolvedValue({
        id: 'r2',
        riderId: 'VF-RD-0002',
        fullName: 'NoKyc',
        kycProfile: null,
        wallet: null,
        guarantor: null,
        leases: [],
      });

      const req = new NextRequest('http://localhost/api/admin/riders/r2', { method: 'GET' });
      const res = await getSingleRider(req, { params: Promise.resolve({ id: 'r2' }) });
      expect(res.status).toBe(200);

      expect(mocks.logKycDocumentView).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // Route 3: KYC queue
  // -----------------------------------------------------------------------
  describe('GET /api/admin/kyc (queue)', () => {
    it('fires one log per record that has rider.id', async () => {
      mocks.kycFindMany.mockResolvedValue([
        {
          id: 'kp1',
          status: 'SUBMITTED',
          rider: { id: 'r1', riderId: 'VF-RD-0001', fullName: 'A' },
        },
        {
          id: 'kp2',
          status: 'PENDING',
          rider: { id: 'r2', riderId: 'VF-RD-0002', fullName: 'B' },
        },
        {
          id: 'kp3',
          status: 'REJECTED',
          rider: { id: 'r3', riderId: 'VF-RD-0003', fullName: 'C' },
        },
      ]);
      mocks.kycCount.mockResolvedValue(3);

      const req = new NextRequest('http://localhost/api/admin/kyc', { method: 'GET' });
      const res = await getKycQueue(req);
      expect(res.status).toBe(200);

      expect(mocks.logKycDocumentView).toHaveBeenCalledTimes(3);
      const calls = mocks.logKycDocumentView.mock.calls.map(
        (c: unknown[]) => c[0] as { riderId: string; documentType: string }
      );
      const byRider = Object.fromEntries(calls.map((c) => [c.riderId, c.documentType]));
      expect(byRider.r1).toBe('kyc_queue');
      expect(byRider.r2).toBe('kyc_queue');
      expect(byRider.r3).toBe('kyc_queue');
    });

    it('skips records without a rider include', async () => {
      mocks.kycFindMany.mockResolvedValue([
        { id: 'kp1', status: 'SUBMITTED', rider: { id: 'r1', riderId: 'X', fullName: 'A' } },
        { id: 'kp2', status: 'SUBMITTED', rider: null }, // orphaned row
      ]);
      mocks.kycCount.mockResolvedValue(2);

      const req = new NextRequest('http://localhost/api/admin/kyc', { method: 'GET' });
      const res = await getKycQueue(req);
      expect(res.status).toBe(200);

      expect(mocks.logKycDocumentView).toHaveBeenCalledTimes(1);
      expect(mocks.logKycDocumentView).toHaveBeenCalledWith({
        adminId: 'admin-1',
        riderId: 'r1',
        documentType: 'kyc_queue',
      });
    });

    it('uses documentType=`kyc_queue`', async () => {
      mocks.kycFindMany.mockResolvedValue([
        {
          id: 'kp1',
          status: 'APPROVED',
          rider: { id: 'r1', riderId: 'VF-RD-0001', fullName: 'A' },
        },
      ]);
      mocks.kycCount.mockResolvedValue(1);

      const req = new NextRequest('http://localhost/api/admin/kyc', { method: 'GET' });
      await getKycQueue(req);

      const call = mocks.logKycDocumentView.mock.calls[0]?.[0] as
        | { documentType: string }
        | undefined;
      expect(call?.documentType).toBe('kyc_queue');
    });
  });
});
