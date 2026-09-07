/**
 * NET-005 follow-up-11 (2026-09-08): bulk KYC route must propagate
 * the rejectionReason from the request body, not hardcode
 * "Bulk action".
 *
 * Background:
 *   - The kyc-management bulk dialog (useKyc.ts:208-214) requires
 *     a 10+ char reason for reject and 5+ char for info_required.
 *   - The frontend sends the reason in the body
 *     (useKyc.ts:232: `rejectionReason: reason?.trim() || undefined`).
 *   - The bulk route at web/src/app/api/admin/riders/bulk/route.ts
 *     used to destructure only `{ids, action, value}` and hardcode
 *     `rejectionReason: 'Bulk action'`. The admin's actual text was
 *     silently dropped.
 *   - The use case's downstream reads (KycProfile column, outbox
 *     KYC_REJECTED / KYC_INFO_REQUESTED notifications, audit log)
 *     all consume `kycData.rejectionReason`, so the rider's
 *     notification carried the literal "Bulk action" string.
 *
 * What this test asserts:
 *   1. REJECTED: body `rejectionReason: 'X'` is passed through to
 *      the use case (rider sees "X", not "Bulk action").
 *   2. INFO_REQUIRED: body `rejectionReason: 'Y'` is passed through
 *      (rider sees "Y" as the info-request text).
 *   3. APPROVED: no `rejectionReason` is sent (unchanged).
 *   4. REJECTED with no body reason: use case gets the per-action
 *      fallback 'Bulk rejection' (not the old 'Bulk action').
 *   5. INFO_REQUIRED with no body reason: use case gets 'Bulk info
 *      request' (not the old 'Bulk action').
 *   6. Body `rejectionReason: '   '` (whitespace only) falls back
 *      to the per-action generic, not an empty string.
 *   7. Empty body `rejectionReason: ''` falls back to the per-action
 *      generic.
 *
 * Pure route-layer test — auth + idempotency + use case are mocked.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  updateRider: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: mocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({ hasPermission: mocks.hasPermission }));

// `withIdempotency` would normally key on `x-idempotency-key` and
// store responses in Redis. For this unit test, just call the inner
// handler directly so the test exercises the bulkKyc branch only.
vi.mock('@/lib/api-middleware', () => ({
  withIdempotency:
    (handler: (req: NextRequest) => Promise<Response>) =>
    (req: NextRequest): Promise<Response> =>
      handler(req),
}));

vi.mock('@/server/modules/riders/admin-riders.use-cases', () => ({
  adminRiderUseCases: {
    update: mocks.updateRider,
  },
}));

import { POST } from '@/app/api/admin/riders/bulk/route';

const makePostReq = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/riders/bulk', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

describe('NET-005 follow-up-11: bulk KYC route propagates rejectionReason', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.updateRider.mockResolvedValue({});
  });

  it('REJECTED: passes body.rejectionReason through to the use case', async () => {
    const req = makePostReq({
      ids: ['r1', 'r2'],
      action: 'bulkKyc',
      value: 'REJECTED',
      rejectionReason: 'Aadhaar image is blurry; please re-upload',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Should be called once per id, with the same payload.
    expect(mocks.updateRider).toHaveBeenCalledTimes(2);
    for (const call of mocks.updateRider.mock.calls) {
      const data = (call[1] as Record<string, unknown>).rejectionReason;
      expect(data).toBe('Aadhaar image is blurry; please re-upload');
    }
  });

  it('INFO_REQUIRED: passes body.rejectionReason through as the info-request text', async () => {
    const req = makePostReq({
      ids: ['r1'],
      action: 'bulkKyc',
      value: 'INFO_REQUIRED',
      rejectionReason: 'PAN number missing on the form',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    expect(mocks.updateRider).toHaveBeenCalledTimes(1);
    const data = mocks.updateRider.mock.calls[0][1] as Record<string, unknown>;
    expect(data.kycStatus).toBe('INFO_REQUIRED');
    expect(data.rejectionReason).toBe('PAN number missing on the form');
  });

  it('APPROVED: does not send a rejectionReason field', async () => {
    const req = makePostReq({
      ids: ['r1', 'r2'],
      action: 'bulkKyc',
      value: 'APPROVED',
      // Frontend never sends this for approve, but assert
      // the route ignores it when value === 'APPROVED'.
      rejectionReason: 'should be ignored',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    for (const call of mocks.updateRider.mock.calls) {
      const data = call[1] as Record<string, unknown>;
      expect(data.kycStatus).toBe('APPROVED');
      expect(data.rejectionReason).toBeUndefined();
    }
  });

  it('REJECTED with no body reason: uses "Bulk rejection" fallback (not "Bulk action")', async () => {
    const req = makePostReq({
      ids: ['r1'],
      action: 'bulkKyc',
      value: 'REJECTED',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = mocks.updateRider.mock.calls[0][1] as Record<string, unknown>;
    expect(data.rejectionReason).toBe('Bulk rejection');
    // Regression lock: the pre-fix hardcoded string must not come back.
    expect(data.rejectionReason).not.toBe('Bulk action');
  });

  it('INFO_REQUIRED with no body reason: uses "Bulk info request" fallback', async () => {
    const req = makePostReq({
      ids: ['r1'],
      action: 'bulkKyc',
      value: 'INFO_REQUIRED',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = mocks.updateRider.mock.calls[0][1] as Record<string, unknown>;
    expect(data.rejectionReason).toBe('Bulk info request');
    expect(data.rejectionReason).not.toBe('Bulk action');
  });

  it('whitespace-only body reason falls back to the per-action generic', async () => {
    const req = makePostReq({
      ids: ['r1'],
      action: 'bulkKyc',
      value: 'REJECTED',
      rejectionReason: '   ',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = mocks.updateRider.mock.calls[0][1] as Record<string, unknown>;
    expect(data.rejectionReason).toBe('Bulk rejection');
  });

  it('empty string body reason falls back to the per-action generic', async () => {
    const req = makePostReq({
      ids: ['r1'],
      action: 'bulkKyc',
      value: 'REJECTED',
      rejectionReason: '',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = mocks.updateRider.mock.calls[0][1] as Record<string, unknown>;
    expect(data.rejectionReason).toBe('Bulk rejection');
  });

  it('trims surrounding whitespace from the body reason', async () => {
    const req = makePostReq({
      ids: ['r1'],
      action: 'bulkKyc',
      value: 'REJECTED',
      rejectionReason: '  Aadhaar is blurry  ',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const data = mocks.updateRider.mock.calls[0][1] as Record<string, unknown>;
    expect(data.rejectionReason).toBe('Aadhaar is blurry');
  });

  it('returns the per-id failure when the use case throws (no silent drop)', async () => {
    mocks.updateRider
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('transition failed'));

    const req = makePostReq({
      ids: ['r1', 'r2'],
      action: 'bulkKyc',
      value: 'REJECTED',
      rejectionReason: 'valid reason',
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.data.count).toBe(1);
    expect(json.data.failures).toEqual([
      { id: 'r2', error: 'transition failed' },
    ]);
  });
});
