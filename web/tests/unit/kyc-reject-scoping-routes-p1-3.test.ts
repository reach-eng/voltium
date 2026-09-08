/**
 * Route-level 422 validation tests for Phase 4 / P1-3 Reject Scoping Parity
 *
 * 1. PUT /api/admin/riders:
 *    - 422 when kycStatus is REJECTED and editableFields is missing or empty
 *    - 422 when kycStatus is INFO_REQUIRED and editableFields is missing or empty
 *    - 200 when kycStatus is REJECTED with non-empty editableFields
 *    - 200 when kycStatus is INFO_REQUIRED with non-empty editableFields
 *
 * 2. POST /api/admin/kyc:
 *    - 422 when action is REJECT and editableFields is missing or empty
 *    - 422 when action is REQUEST_INFO and editableFields is missing or empty
 *    - 200 when action is REJECT with non-empty editableFields
 *    - 200 when action is REQUEST_INFO with non-empty editableFields
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  getAdminSession: vi.fn(),
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  updateRiderUseCase: vi.fn(),
  reviewKycUseCase: vi.fn(),
  approveKycUseCase: vi.fn(),
  reopenExpiredKycUseCase: vi.fn(),
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
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    update: mocks.updateRiderUseCase,
  },
}));

vi.mock('@/server/modules/kyc/kyc.use-cases', () => ({
  kycUseCases: {
    reviewKyc: mocks.reviewKycUseCase,
    reopenExpiredKyc: mocks.reopenExpiredKycUseCase,
  },
}));

vi.mock('@/server/modules/kyc/use-cases/approveKyc', () => ({
  approveKyc: mocks.approveKycUseCase,
}));

vi.mock('@/server/modules/kyc/use-cases/errors', () => ({
  KycApproveError: class KycApproveError extends Error {},
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn(),
  invalidateRiderCache: vi.fn(),
  getOrSetResponse: vi.fn((_key, fn) => fn()),
}));

import { PUT as updateRider } from '@/app/api/admin/riders/route';
import { POST as kycPost } from '@/app/api/admin/kyc/route';

const makePutReq = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/riders', {
    method: 'PUT',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

const makeKycPostReq = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/kyc', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('Phase 4 (P1-3): PUT /api/admin/riders editableFields 422 assertion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdminSession.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.updateRiderUseCase.mockResolvedValue({ id: 'r1', kycStatus: 'REJECTED' });
  });

  it('returns 422 when kycStatus is REJECTED without editableFields', async () => {
    const req = makePutReq({
      id: 'r1',
      kycStatus: 'REJECTED',
      rejectionReason: 'Blurry documents',
    });
    const res = await updateRider(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.updateRiderUseCase).not.toHaveBeenCalled();
  });

  it('returns 422 when kycStatus is REJECTED with empty editableFields array', async () => {
    const req = makePutReq({
      id: 'r1',
      kycStatus: 'REJECTED',
      rejectionReason: 'Blurry documents',
      editableFields: [],
    });
    const res = await updateRider(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.updateRiderUseCase).not.toHaveBeenCalled();
  });

  it('returns 422 when kycStatus is INFO_REQUIRED without editableFields', async () => {
    const req = makePutReq({
      id: 'r1',
      kycStatus: 'INFO_REQUIRED',
      rejectionReason: 'Need clearer PAN card',
    });
    const res = await updateRider(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.updateRiderUseCase).not.toHaveBeenCalled();
  });

  it('returns 422 when kycStatus is INFO_REQUIRED with empty editableFields array', async () => {
    const req = makePutReq({
      id: 'r1',
      kycStatus: 'INFO_REQUIRED',
      rejectionReason: 'Need clearer PAN card',
      editableFields: [],
    });
    const res = await updateRider(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.updateRiderUseCase).not.toHaveBeenCalled();
  });

  it('returns 200 when kycStatus is REJECTED with non-empty editableFields', async () => {
    const req = makePutReq({
      id: 'r1',
      kycStatus: 'REJECTED',
      rejectionReason: 'Blurry Aadhaar',
      editableFields: ['aadhaarFront', 'aadhaarBack'],
    });
    const res = await updateRider(req);
    expect(res.status).toBe(200);
    expect(mocks.updateRiderUseCase).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        kycStatus: 'REJECTED',
        rejectionReason: 'Blurry Aadhaar',
        editableFields: ['aadhaarFront', 'aadhaarBack'],
      }),
      expect.anything()
    );
  });

  it('returns 200 when kycStatus is INFO_REQUIRED with non-empty editableFields', async () => {
    mocks.updateRiderUseCase.mockResolvedValue({ id: 'r1', kycStatus: 'INFO_REQUIRED' });
    const req = makePutReq({
      id: 'r1',
      kycStatus: 'INFO_REQUIRED',
      rejectionReason: 'Bank IFSC is wrong',
      editableFields: ['ifscCode'],
    });
    const res = await updateRider(req);
    expect(res.status).toBe(200);
    expect(mocks.updateRiderUseCase).toHaveBeenCalledWith(
      'r1',
      expect.objectContaining({
        kycStatus: 'INFO_REQUIRED',
        rejectionReason: 'Bank IFSC is wrong',
        editableFields: ['ifscCode'],
      }),
      expect.anything()
    );
  });
});

describe('Phase 4 (P1-3): POST /api/admin/kyc editableFields 422 assertion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.reviewKycUseCase.mockResolvedValue({ id: 'kp1' });
  });

  it('returns 422 when action is REJECT without editableFields', async () => {
    const req = makeKycPostReq({
      riderId: 'r1',
      action: 'REJECT',
      reason: 'Photo is blurry',
    });
    const res = await kycPost(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.reviewKycUseCase).not.toHaveBeenCalled();
  });

  it('returns 422 when action is REJECT with empty editableFields array', async () => {
    const req = makeKycPostReq({
      riderId: 'r1',
      action: 'REJECT',
      reason: 'Photo is blurry',
      editableFields: [],
    });
    const res = await kycPost(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.reviewKycUseCase).not.toHaveBeenCalled();
  });

  it('returns 422 when action is REQUEST_INFO without editableFields', async () => {
    const req = makeKycPostReq({
      riderId: 'r1',
      action: 'REQUEST_INFO',
      message: 'Need updated photo',
    });
    const res = await kycPost(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.reviewKycUseCase).not.toHaveBeenCalled();
  });

  it('returns 422 when action is REQUEST_INFO with empty editableFields array', async () => {
    const req = makeKycPostReq({
      riderId: 'r1',
      action: 'REQUEST_INFO',
      message: 'Need updated photo',
      editableFields: [],
    });
    const res = await kycPost(req);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error.message).toContain('require a non-empty editableFields allowlist');
    expect(mocks.reviewKycUseCase).not.toHaveBeenCalled();
  });

  it('returns 200 when action is REJECT with non-empty editableFields', async () => {
    const req = makeKycPostReq({
      riderId: 'r1',
      action: 'REJECT',
      reason: 'Photo is blurry',
      editableFields: ['profilePhoto', 'riderPhoto'],
    });
    const res = await kycPost(req);
    expect(res.status).toBe(200);
    expect(mocks.reviewKycUseCase).toHaveBeenCalledWith(
      'r1',
      'admin-1',
      expect.objectContaining({
        action: 'REJECT',
        editableFields: ['profilePhoto', 'riderPhoto'],
      })
    );
  });

  it('returns 200 when action is REQUEST_INFO with non-empty editableFields', async () => {
    const req = makeKycPostReq({
      riderId: 'r1',
      action: 'REQUEST_INFO',
      message: 'Need updated PAN',
      editableFields: ['panCard'],
    });
    const res = await kycPost(req);
    expect(res.status).toBe(200);
    expect(mocks.reviewKycUseCase).toHaveBeenCalledWith(
      'r1',
      'admin-1',
      expect.objectContaining({
        action: 'REQUEST_INFO',
        editableFields: ['panCard'],
      })
    );
  });
});
