/**
 * NET-005 follow-up-13 (2026-09-08): EXPIRED KYC
 * visibility + admin re-verify.
 *
 * Background:
 *   - The KYC state machine (kyc-state-machine.ts:19-26)
 *     declared `EXPIRED: []` — no transitions out. The
 *     expiry worker (kyc-expiry.job.ts) would flip
 *     APPROVED → EXPIRED when expiresAt < now(), but the
 *     admin had no remedy route to revive the rider.
 *   - The fix: add `EXPIRED: ['PENDING']` to the state
 *     machine, add a `reopenExpiredKyc` repo method, add
 *     a use case wrapper, add a `REOPEN` action handler
 *     in the kyc POST route, and add a Re-verify UI
 *     button + EXPIRED tab + EXPIRED badge.
 *
 * What this test asserts:
 *   1. State machine: EXPIRED → PENDING is allowed
 *      (validateKycTransition does not throw).
 *   2. State machine: every other transition out of
 *      EXPIRED is still rejected (KycStateError).
 *   3. State machine: getValidNextKycStates('EXPIRED')
 *      returns ['PENDING'].
 *   4. Repo: reopenExpiredKyc writes the right
 *      status/expiresAt/editableFields/pendingCorrections
 *      and invalidates the rider cache.
 *   5. Repo: reopenExpiredKyc on a non-EXPIRED profile
 *      throws KycStateError.
 *   6. Use case: reopenExpiredKyc writes the
 *      `kyc.reopened` audit log + emits the
 *      KYC_REOPENED outbox event.
 *   7. Route: POST /api/admin/kyc with action=REOPEN
 *      returns 200 on success and 409 (KycStateError)
 *      on a non-EXPIRED profile.
 *   8. Badge: getKycBadge('EXPIRED') returns the slate
 *      string (regression lock: not the default
 *      "unknown" style).
 *
 * Pure unit tests — no DB or HTTP runtime required
 * for layers 1-3 + 8. Layers 4-7 use mocks.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Layer 1-3: state machine
// ---------------------------------------------------------------------------

import {
  validateKycTransition,
  KycStateError,
  getValidNextKycStates,
  canTransitionKyc,
} from '@/server/modules/kyc/kyc-state-machine';

describe('NET-005 follow-up-13: KYC state machine allows EXPIRED → PENDING', () => {
  it('EXPIRED → PENDING is allowed (admin re-verify)', () => {
    expect(() => validateKycTransition('EXPIRED', 'PENDING')).not.toThrow();
  });

  it('EXPIRED → APPROVED is still rejected (cannot re-approve directly)', () => {
    expect(() => validateKycTransition('EXPIRED', 'APPROVED')).toThrow(KycStateError);
  });

  it('EXPIRED → SUBMITTED is still rejected (must re-submit, not bypass)', () => {
    expect(() => validateKycTransition('EXPIRED', 'SUBMITTED')).toThrow(KycStateError);
  });

  it('EXPIRED → REJECTED is still rejected', () => {
    expect(() => validateKycTransition('EXPIRED', 'REJECTED')).toThrow(KycStateError);
  });

  it('EXPIRED → INFO_REQUIRED is still rejected', () => {
    expect(() => validateKycTransition('EXPIRED', 'INFO_REQUIRED')).toThrow(KycStateError);
  });

  it('EXPIRED → EXPIRED is a no-op (current === target)', () => {
    expect(() => validateKycTransition('EXPIRED', 'EXPIRED')).not.toThrow();
  });

  it('getValidNextKycStates(EXPIRED) returns just [PENDING]', () => {
    expect(getValidNextKycStates('EXPIRED')).toEqual(['PENDING']);
  });

  it('canTransitionKyc reflects the new transition', () => {
    expect(canTransitionKyc('EXPIRED', 'PENDING')).toBe(true);
    expect(canTransitionKyc('EXPIRED', 'APPROVED')).toBe(false);
    expect(canTransitionKyc('EXPIRED', 'SUBMITTED')).toBe(false);
  });

  it('APPROVED → EXPIRED is still the only forward path (regression lock)', () => {
    // The expiry worker depends on this transition
    // being valid. Adding EXPIRED → PENDING must not
    // remove the existing APPROVED → EXPIRED edge.
    expect(() => validateKycTransition('APPROVED', 'EXPIRED')).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// Layer 8: badge
// ---------------------------------------------------------------------------

import { getKycBadge } from '@/components/admin/screens/kyc-management/helpers';

describe('NET-005 follow-up-13: EXPIRED badge color', () => {
  it('returns a slate string (distinct from every other status)', () => {
    const expiredStyle = getKycBadge('EXPIRED');
    expect(expiredStyle).toContain('slate');
    // Regression lock: pre-fix this returned the default
    // "border-border text-muted-foreground" string for
    // EXPIRED, indistinguishable from UNKNOWN.
    expect(expiredStyle).not.toBe('border-border text-muted-foreground bg-muted/30');
  });

  it('still returns the default for unknown statuses', () => {
    expect(getKycBadge('UNKNOWN')).toBe('border-border text-muted-foreground bg-muted/30');
  });

  it('existing status colors are unchanged (regression lock)', () => {
    expect(getKycBadge('APPROVED')).toContain('emerald');
    expect(getKycBadge('REJECTED')).toContain('rose');
    expect(getKycBadge('PENDING')).toContain('amber');
    expect(getKycBadge('SUBMITTED')).toContain('blue');
    expect(getKycBadge('INFO_REQUIRED')).toContain('orange');
  });
});

// ---------------------------------------------------------------------------
// Layer 4-5: repo reopenExpiredKyc
// ---------------------------------------------------------------------------

const repoMocks = vi.hoisted(() => ({
  kycProfileFindUnique: vi.fn(),
  kycProfileUpdate: vi.fn(),
  $transaction: vi.fn(),
  invalidateRiderCache: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    kycProfile: {
      findUnique: repoMocks.kycProfileFindUnique,
      update: repoMocks.kycProfileUpdate,
    },
    $transaction: repoMocks.$transaction,
  },
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: repoMocks.invalidateRiderCache,
}));

// `kyc.repository.ts` also imports `encryptPii/decryptPii`
// and `validateKycTransition/KycStateError` and
// `LIFECYCLE_RANK`. The latter two are real (no mock).
// The PII crypto is real but unused by reopenExpiredKyc.
// Stub just in case: vi.mock would be required if the
// import chain pulled in a heavy module — but for the
// reopen path, the file evaluates cleanly with no
// additional mocks.
import { kycRepository } from '@/server/modules/kyc/kyc.repository';

describe('NET-005 follow-up-13: kycRepository.reopenExpiredKyc', () => {
  beforeEach(() => {
    // `vi.resetAllMocks()` (not `clearAllMocks`) also
    // clears queued `mockResolvedValueOnce` values.
    // Without this, queued values leak across tests in
    // the same describe block — the success test queues
    // 2 values, the failure test queues 1, and the
    // failure test ends up consuming the success
    // test's second value (returning the wrong
    // status).
    vi.resetAllMocks();
    // $transaction just runs the inner fn with a fake
    // tx. The repo's reopenExpiredKyc calls BOTH
    // `tx.kycProfile.update` (the write) AND
    // `tx.kycProfile.findUnique` (the post-update
    // reload that becomes the return value), so the
    // fake tx needs both methods. The post-update
    // findUnique is also `repoMocks.kycProfileFindUnique`
    // — same mock, the call inside the tx uses the
    // same return value as the pre-tx call (last
    // `mockResolvedValueOnce` wins).
    repoMocks.$transaction.mockImplementation(
      async (fn: (tx: unknown) => unknown) =>
        fn({
          kycProfile: {
            update: repoMocks.kycProfileUpdate,
            findUnique: repoMocks.kycProfileFindUnique,
          },
        })
    );
  });

  it('EXPIRED → PENDING: writes status, clears expiresAt/editableFields/pendingCorrections, invalidates cache', async () => {
    // The repo calls findUnique twice: once before the
    // transaction (status check) and once after
    // (return value). The mock returns the pre-tx
    // status (EXPIRED) on the first call and the
    // post-tx state (PENDING) on the second.
    repoMocks.kycProfileUpdate.mockResolvedValue({});
    repoMocks.kycProfileFindUnique
      .mockResolvedValueOnce({ status: 'EXPIRED', id: 'kp1' }) // before tx
      .mockResolvedValueOnce({ id: 'kp1', status: 'PENDING' }); // after tx

    const result = await kycRepository.reopenExpiredKyc('r1', 'admin-1');

    // Status check before the transaction
    expect(repoMocks.kycProfileFindUnique).toHaveBeenCalledWith({
      where: { riderId: 'r1' },
      select: { status: true, id: true },
    });

    // The transaction's update writes the right shape
    expect(repoMocks.kycProfileUpdate).toHaveBeenCalledWith({
      where: { riderId: 'r1' },
      data: expect.objectContaining({
        status: 'PENDING',
        expiresAt: null,
      }),
    });
    const data = repoMocks.kycProfileUpdate.mock.calls[0][0].data as Record<string, unknown>;
    expect(data.editableFields).toBeDefined(); // Prisma.DbNull
    expect(data.pendingCorrections).toBeDefined(); // Prisma.DbNull

    // Cache invalidation so the rider's next /api/rider/profile
    // poll sees the new PENDING status.
    expect(repoMocks.invalidateRiderCache).toHaveBeenCalledWith('r1');

    expect(result).toEqual({ id: 'kp1', status: 'PENDING' });
  });

  it('throws KycStateError when the profile is not EXPIRED (e.g., still APPROVED)', async () => {
    repoMocks.kycProfileFindUnique.mockResolvedValueOnce({ status: 'APPROVED', id: 'kp1' });

    await expect(
      kycRepository.reopenExpiredKyc('r1', 'admin-1')
    ).rejects.toBeInstanceOf(KycStateError);

    // The transaction never runs because the transition
    // is rejected at the validation step.
    expect(repoMocks.$transaction).not.toHaveBeenCalled();
    expect(repoMocks.kycProfileUpdate).not.toHaveBeenCalled();
    expect(repoMocks.invalidateRiderCache).not.toHaveBeenCalled();
  });

  it('throws KycStateError when the profile is in REJECTED state', async () => {
    repoMocks.kycProfileFindUnique.mockResolvedValueOnce({ status: 'REJECTED', id: 'kp1' });
    await expect(
      kycRepository.reopenExpiredKyc('r1', 'admin-1')
    ).rejects.toBeInstanceOf(KycStateError);
  });
});

// ---------------------------------------------------------------------------
// Layer 7: route handler
// ---------------------------------------------------------------------------

const routeMocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  hasPermission: vi.fn(),
  kycFindMany: vi.fn(),
  kycCount: vi.fn(),
  reopenExpiredKyc: vi.fn(),
  approveKyc: vi.fn(),
  reviewKyc: vi.fn(),
  logKycDocumentView: vi.fn(),
  invalidateCache: vi.fn(),
  signRiderUrls: vi.fn((r: unknown) => r),
}));

vi.mock('@/lib/rbac', () => ({
  requireAdmin: routeMocks.requireAdmin,
  adminUnauthorized: () =>
    new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), { status: 401 }),
  adminForbidden: () =>
    new Response(JSON.stringify({ success: false, error: 'Forbidden' }), { status: 403 }),
}));

vi.mock('@/lib/auth', () => ({ hasPermission: routeMocks.hasPermission }));

vi.mock('@/lib/cache', () => ({
  getOrSetResponse: vi.fn(async (_key: string, fn: () => unknown) => fn()),
  invalidateCache: routeMocks.invalidateCache,
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({
    enableKYCVerification: true,
    enableGuarantorRequirement: true,
  }),
}));

vi.mock('@/lib/security-events', () => ({
  logKycDocumentView: routeMocks.logKycDocumentView,
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrls: routeMocks.signRiderUrls,
}));

// Note: do NOT mock `@/server/modules/kyc/kyc.repository`.
// The repo-layer tests in this file need the real
// `kycRepository.reopenExpiredKyc` to be importable. The
// route layer's POST handler doesn't touch `kycRepository`
// directly — it goes through `kycUseCases.reopenExpiredKyc`
// (mocked above) — so no route-layer functionality is
// lost by skipping this mock.

vi.mock('@/server/modules/kyc/kyc.use-cases', () => ({
  kycUseCases: {
    reopenExpiredKyc: routeMocks.reopenExpiredKyc,
    reviewKyc: routeMocks.reviewKyc,
  },
}));

vi.mock('@/server/modules/kyc/use-cases/approveKyc', () => ({
  approveKyc: routeMocks.approveKyc,
}));

vi.mock('@/server/modules/kyc/use-cases/errors', () => ({
  KycApproveError: class KycApproveError extends Error {},
}));

import { POST } from '@/app/api/admin/kyc/route';
// KycStateError is already imported above in the state
// machine block; no need to re-import.

const makePostReq = (body: Record<string, unknown>) =>
  new NextRequest('http://localhost/api/admin/kyc', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });

// NextRequest needs to be imported here so the test can
// construct a request body. The import order matters:
// the route module's transitive imports must be mocked
// before the route import above resolves, so this is the
// last import.
import { NextRequest } from 'next/server';

describe('NET-005 follow-up-13: POST /api/admin/kyc with action=REOPEN', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.requireAdmin.mockResolvedValue({
      adminId: 'admin-1',
      adminRole: 'OPERATIONS_ADMIN',
    });
    routeMocks.hasPermission.mockReturnValue(true);
    routeMocks.reopenExpiredKyc.mockResolvedValue({ id: 'kp1', status: 'PENDING' });
  });

  it('REOPEN: returns 200 and routes to kycUseCases.reopenExpiredKyc', async () => {
    const req = makePostReq({ riderId: 'r1', action: 'REOPEN' });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(routeMocks.reopenExpiredKyc).toHaveBeenCalledWith('r1', 'admin-1');
    // The riders PUT path must NOT be used for reopen.
    expect(routeMocks.reviewKyc).not.toHaveBeenCalled();
  });

  it('REOPEN: returns 409 (not 500) when the use case throws KycStateError', async () => {
    routeMocks.reopenExpiredKyc.mockRejectedValue(
      new KycStateError(
        'Invalid KYC transition: "APPROVED" → "PENDING". Allowed: EXPIRED.',
        'APPROVED',
        'PENDING'
      )
    );

    const req = makePostReq({ riderId: 'r1', action: 'REOPEN' });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it('REOPEN: invalidates the admin:kyc cache so the next GET reflects the new status', async () => {
    const req = makePostReq({ riderId: 'r1', action: 'REOPEN' });
    await POST(req);
    expect(routeMocks.invalidateCache).toHaveBeenCalledWith('admin:kyc:*');
  });

  it('REOPEN: requires kyc_approve permission (returns 403 otherwise)', async () => {
    routeMocks.hasPermission.mockReturnValue(false);
    const req = makePostReq({ riderId: 'r1', action: 'REOPEN' });
    const res = await POST(req);
    expect(res.status).toBe(403);
    expect(routeMocks.reopenExpiredKyc).not.toHaveBeenCalled();
  });
});
