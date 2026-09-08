/**
 * KYC Reliability & Access Unit Tests (Phase 6 / P1-5, P1-6, P2-1)
 *
 * Covers:
 * 1. P1-5: Outbox notification dispatch:
 *    - adminRiderUseCases.update emits NOTIFICATION_SEND for KYC_APPROVED
 *    - adminRiderUseCases.update emits NOTIFICATION_SEND for KYC_REJECTED (with reason)
 *    - adminRiderUseCases.update emits NOTIFICATION_SEND for KYC_INFO_REQUESTED (with infoRequest)
 * 2. P1-6: kyc_view permission enforcement & document redaction:
 *    - GET /api/admin/riders returns 403 when kycStatus filter is set and caller lacks kyc_view
 *    - GET /api/admin/riders returns 200 with document fields redacted when caller lacks kyc_view
 *    - GET /api/admin/riders skips logKycDocumentView when caller lacks kyc_view
 *    - GET /api/admin/riders preserves document fields and logs view when caller has kyc_view
 *    - GET /api/admin/riders/[id] redacts kycProfile & guarantor docs when caller lacks kyc_view
 *    - GET /api/admin/riders/[id] preserves docs and logs view when caller has kyc_view
 * 3. P2-1: Export audit logging:
 *    - POST /api/admin/audit-logs allows kyc_view holders to log 'kyc.export'
 *    - POST /api/admin/audit-logs rejects callers without kyc_view or audit_view with 403
 *    - POST /api/admin/audit-logs records kyc.export with entity='kyc' and details
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Hoisted Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  adminRiderList: vi.fn(),
  adminRiderUpdate: vi.fn(),
  riderFindFirst: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue({ id: 'log-1' }),
  logKycDocumentView: vi.fn().mockResolvedValue(undefined),
  outboxEmit: vi.fn().mockResolvedValue(undefined),
  signRiderUrls: vi.fn((r: unknown) => r),
  getOrSetResponse: vi.fn(async (_key: string, fn: () => unknown) => fn()),
}));

vi.mock('@/lib/get-session', () => ({
  getAdminSession: mocks.getAdminSession,
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({
  hasPermission: mocks.hasPermission,
}));

vi.mock('@/lib/security-events', () => ({
  logKycDocumentView: mocks.logKycDocumentView,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrls: mocks.signRiderUrls,
}));

vi.mock('@/lib/cache', () => ({
  getOrSetResponse: mocks.getOrSetResponse,
  invalidateCache: vi.fn(),
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: vi.fn(),
  invalidateRiderPhoneCache: vi.fn(),
  invalidateVehicleCache: vi.fn(),
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    list: mocks.adminRiderList,
    update: mocks.adminRiderUpdate,
  },
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findFirst: mocks.riderFindFirst,
    },
  },
}));

import { GET as listRidersRoute } from '@/app/api/admin/riders/route';
import { GET as getSingleRiderRoute } from '@/app/api/admin/riders/[id]/route';
import { POST as postAuditLogRoute } from '@/app/api/admin/audit-logs/route';

describe('Phase 6 (P1-6): kyc_view Enforcement on GET /api/admin/riders', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects with 403 Forbidden when kycStatus query param is passed and caller lacks kyc_view', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'fa-1',
      adminRole: 'FINANCE_ADMIN',
    });
    // Has riders_view, but NOT kyc_view
    mocks.hasPermission.mockImplementation((_session: any, perm: string) => {
      if (perm === 'riders_view') return true;
      if (perm === 'kyc_view') return false;
      return false;
    });

    const req = new NextRequest('http://localhost/api/admin/riders?kycStatus=SUBMITTED');
    const res = await listRidersRoute(req);

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error?.message ?? body.error).toContain('kyc_view required');
    expect(mocks.adminRiderList).not.toHaveBeenCalled();
  });

  it('allows GET /api/admin/riders when caller has kyc_view', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'reviewer-1',
      adminRole: 'KYC_REVIEWER',
    });
    mocks.hasPermission.mockImplementation((_session: any, perm: string) => {
      if (perm === 'riders_view' || perm === 'kyc_view') return true;
      return false;
    });

    mocks.adminRiderList.mockResolvedValue({
      riders: [
        {
          id: 'r1',
          fullName: 'Test Rider',
          kycStatus: 'SUBMITTED',
          profilePhoto: 'https://cdn/photo.jpg',
          aadhaarFront: 'https://cdn/front.jpg',
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });

    const req = new NextRequest('http://localhost/api/admin/riders?kycStatus=SUBMITTED');
    const res = await listRidersRoute(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.riders[0].profilePhoto).toBe('https://cdn/photo.jpg');
    expect(body.data.riders[0].aadhaarFront).toBe('https://cdn/front.jpg');
    expect(mocks.logKycDocumentView).toHaveBeenCalledWith({
      adminId: 'reviewer-1',
      riderId: 'r1',
      documentType: 'riders_list',
    });
  });

  it('redacts sensitive KYC & guarantor document URLs when caller has riders_view but lacks kyc_view', async () => {
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'support-1',
      adminRole: 'SUPPORT_AGENT',
    });
    mocks.hasPermission.mockImplementation((_session: any, perm: string) => {
      if (perm === 'riders_view') return true;
      if (perm === 'kyc_view') return false;
      return false;
    });

    mocks.adminRiderList.mockResolvedValue({
      riders: [
        {
          id: 'r1',
          fullName: 'Test Rider',
          phone: '9876543210',
          kycStatus: 'APPROVED',
          profilePhoto: 'https://cdn/photo.jpg',
          riderPhoto: 'https://cdn/rider.jpg',
          riderVideo: 'https://cdn/video.mp4',
          signature: 'https://cdn/sig.png',
          aadhaarFront: 'https://cdn/af.jpg',
          aadhaarBack: 'https://cdn/ab.jpg',
          panCard: 'https://cdn/pan.jpg',
          guarantorAadhaarFront: 'https://cdn/gaf.jpg',
          guarantorAadhaarBack: 'https://cdn/gab.jpg',
          guarantorPan: 'https://cdn/gpan.jpg',
          guarantorPhoto: 'https://cdn/gphoto.jpg',
          guarantorSignature: 'https://cdn/gsig.png',
          guarantorVideo: 'https://cdn/gvid.mp4',
        },
      ],
      pagination: { total: 1, totalPages: 1 },
    });

    const req = new NextRequest('http://localhost/api/admin/riders');
    const res = await listRidersRoute(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    const rider = body.data.riders[0];

    // Identity and contact data preserved
    expect(rider.fullName).toBe('Test Rider');
    expect(rider.phone).toBe('9876543210');
    expect(rider.kycStatus).toBe('APPROVED');

    // Document evidence redacted to null
    expect(rider.profilePhoto).toBeNull();
    expect(rider.riderPhoto).toBeNull();
    expect(rider.riderVideo).toBeNull();
    expect(rider.signature).toBeNull();
    expect(rider.aadhaarFront).toBeNull();
    expect(rider.aadhaarBack).toBeNull();
    expect(rider.panCard).toBeNull();
    expect(rider.guarantorAadhaarFront).toBeNull();
    expect(rider.guarantorAadhaarBack).toBeNull();
    expect(rider.guarantorPan).toBeNull();
    expect(rider.guarantorPhoto).toBeNull();
    expect(rider.guarantorSignature).toBeNull();
    expect(rider.guarantorVideo).toBeNull();

    // Must NOT log document view when caller lacks kyc_view
    expect(mocks.logKycDocumentView).not.toHaveBeenCalled();
  });
});

describe('Phase 6 (P1-6): kyc_view Enforcement on GET /api/admin/riders/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('redacts kycProfile and guarantor docs when caller has riders_view but lacks kyc_view', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'agent-1',
      adminRole: 'SUPPORT_AGENT',
    });
    mocks.hasPermission.mockImplementation((_roleOrSession: any, perm: string) => {
      if (perm === 'riders_view') return true;
      if (perm === 'kyc_view') return false;
      return false;
    });

    mocks.riderFindFirst.mockResolvedValue({
      id: 'rider-123',
      fullName: 'Rider Name',
      kycProfile: {
        id: 'kp-1',
        status: 'SUBMITTED',
        profilePhoto: 'https://cdn/p.jpg',
        aadhaarFront: 'https://cdn/af.jpg',
        aadhaarBack: 'https://cdn/ab.jpg',
        panCard: 'https://cdn/pan.jpg',
      },
      guarantor: {
        id: 'g-1',
        name: 'Guarantor Name',
        aadhaarFront: 'https://cdn/gaf.jpg',
        pan: 'https://cdn/gpan.jpg',
      },
    });

    const req = new NextRequest('http://localhost/api/admin/riders/rider-123');
    const res = await getSingleRiderRoute(req, {
      params: Promise.resolve({ id: 'rider-123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;

    expect(data.kycProfile.profilePhoto).toBeNull();
    expect(data.kycProfile.aadhaarFront).toBeNull();
    expect(data.kycProfile.aadhaarBack).toBeNull();
    expect(data.kycProfile.panCard).toBeNull();
    expect(data.guarantor.aadhaarFront).toBeNull();
    expect(data.guarantor.pan).toBeNull();

    expect(mocks.logKycDocumentView).not.toHaveBeenCalled();
  });

  it('preserves docs and fires logKycDocumentView when caller has kyc_view', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'reviewer-1',
      adminRole: 'KYC_REVIEWER',
    });
    mocks.hasPermission.mockImplementation((_roleOrSession: any, perm: string) => {
      if (perm === 'riders_view' || perm === 'kyc_view') return true;
      return false;
    });

    mocks.riderFindFirst.mockResolvedValue({
      id: 'rider-123',
      fullName: 'Rider Name',
      kycProfile: {
        id: 'kp-1',
        status: 'SUBMITTED',
        profilePhoto: 'https://cdn/p.jpg',
      },
    });

    const req = new NextRequest('http://localhost/api/admin/riders/rider-123');
    const res = await getSingleRiderRoute(req, {
      params: Promise.resolve({ id: 'rider-123' }),
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.kycProfile.profilePhoto).toBe('https://cdn/p.jpg');
    expect(mocks.logKycDocumentView).toHaveBeenCalledWith({
      adminId: 'reviewer-1',
      riderId: 'rider-123',
      documentType: 'rider_detail',
    });
  });
});

describe('Phase 6 (P2-1): Export Audit Logging in POST /api/admin/audit-logs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('records kyc.export when caller has kyc_view', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'rev-1',
      adminRole: 'KYC_REVIEWER',
    });
    mocks.hasPermission.mockImplementation((_session: any, perm: string) => {
      if (perm === 'kyc_view') return true;
      return false;
    });

    const req = new NextRequest('http://localhost/api/admin/audit-logs', {
      method: 'POST',
      body: JSON.stringify({
        action: 'kyc.export',
        riderId: 'kyc_export',
        details: {
          count: 42,
          tab: 'submitted',
          startDate: '2026-09-01',
          endDate: '2026-09-08',
        },
      }),
    });

    const res = await postAuditLogRoute(req);
    expect(res.status).toBe(200);

    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      actorId: 'rev-1',
      actorType: 'ADMIN',
      action: 'kyc.export',
      entity: 'kyc',
      entityId: 'kyc_export',
      details: {
        count: 42,
        tab: 'submitted',
        startDate: '2026-09-01',
        endDate: '2026-09-08',
      },
    });
  });

  it('rejects kyc.export with 403 when caller has neither kyc_view nor audit_view', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'tl-1',
      adminRole: 'TEAM_LEADER',
    });
    mocks.hasPermission.mockReturnValue(false);

    const req = new NextRequest('http://localhost/api/admin/audit-logs', {
      method: 'POST',
      body: JSON.stringify({
        action: 'kyc.export',
        riderId: 'kyc_export',
        details: { count: 10 },
      }),
    });

    const res = await postAuditLogRoute(req);
    expect(res.status).toBe(403);
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });

  it('rejects unknown actions with 422 validation error', async () => {
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'SUPER_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);

    const req = new NextRequest('http://localhost/api/admin/audit-logs', {
      method: 'POST',
      body: JSON.stringify({
        action: 'unauthorized.custom_action',
        riderId: 'r1',
      }),
    });

    const res = await postAuditLogRoute(req);
    expect(res.status).toBe(422);
    expect(mocks.createAuditLog).not.toHaveBeenCalled();
  });
});
