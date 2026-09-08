/**
 * NET-005 follow-up-19 (2026-09-08): state-machine
 * validation in adminRiderUseCases.update().
 *
 * Two sub-fixes:
 *   1. `update()` now calls `validateTransition`
 *      for any `lifecycleStatus` write.
 *   2. `update()` now calls `validateGuarantorTransition`
 *      for any `guarantorStatus` write (direct OR
 *      KYC side-effect at line 545-547/575).
 *
 * The pre-fix code wrote these directly to the DB
 * with no state-machine check.
 *
 * (The data-deletion execute + restore validations
 * are covered in `data-deletion-state-machine-19.test.ts`
 * — split into a separate file because they have a
 * different mock footprint.)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  riderUpdate: vi.fn(),
  upsert: vi.fn(),
  guarantorFindUnique: vi.fn(),
  guarantorUpsert: vi.fn(),
  kycProfileFindUnique: vi.fn(),
  kycProfileUpsert: vi.fn(),
  transaction: vi.fn(),
  getCachedRider: vi.fn((_id: unknown, fn: () => unknown) => fn()),
  invalidateRiderCache: vi.fn(),
  invalidateCache: vi.fn(),
  outboxEmit: vi.fn(),
  promoteToApproved: vi.fn(),
  promoteToRejected: vi.fn(),
  promoteToInfoRequired: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.riderUpdate,
    },
    guarantor: {
      findUnique: mocks.guarantorFindUnique,
      upsert: mocks.guarantorUpsert,
    },
    kycProfile: {
      findUnique: mocks.kycProfileFindUnique,
      upsert: mocks.kycProfileUpsert,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: mocks.getCachedRider,
  invalidateRiderCache: mocks.invalidateRiderCache,
  invalidateRiderPhoneCache: vi.fn(),
  invalidateVehicleCache: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: mocks.invalidateCache,
  getOrSetResponse: vi.fn(),
}));

vi.mock('@/lib/notification-service', () => ({
  notificationService: { notifyKycStatusChange: vi.fn() },
}));

vi.mock('@/lib/audit-log', () => ({
  // The use-case calls `createAuditLog({...}).catch(()=>{})`
  // at the end of the kyc block — must return a
  // thenable so the `.catch` call doesn't throw.
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  getExpiresAt: () => new Date(Date.now() + 90 * 86400000),
}));

vi.mock('@/lib/security-events', () => ({
  logAccountSuspension: vi.fn(),
}));

vi.mock('@/lib/flatten-rider', () => ({
  flattenRider: vi.fn((r: unknown) => r),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeText: (v: unknown) => v,
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrlsWithProvider: vi.fn((r: unknown) => r),
}));

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: mocks.outboxEmit },
  OutboxEventTypes: { NOTIFICATION_SEND: 'NOTIFICATION_SEND' },
}));

vi.mock('@/server/modules/kyc/kyc.repository', () => ({
  promoteToApproved: mocks.promoteToApproved,
  promoteToRejected: mocks.promoteToRejected,
  promoteToInfoRequired: mocks.promoteToInfoRequired,
}));

vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: { credit: vi.fn(), debit: vi.fn() },
}));

import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import {
  RiderLifecycleError,
  validateTransition,
} from '@/server/modules/riders/rider-lifecycle.service';
import {
  GuarantorStateError,
  validateGuarantorTransition,
} from '@/server/modules/guarantors/guarantor-state-machine';

describe('NET-005 follow-up-19: state-machine validation in admin update()', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set the getCachedRider mock because
    // `vi.clearAllMocks` resets the implementation
    // alongside the call history.
    mocks.getCachedRider.mockImplementation((_id, fn) => fn());
    // The transaction is called with a callback that
    // returns the result. We invoke it with a fake `tx`
    // that has the same methods the use-case uses.
    mocks.transaction.mockImplementation(async (cb) => {
      const tx = {
        rider: {
          update: mocks.riderUpdate,
          // The use-case's transaction body reloads the
          // rider at the end (line 818-820) for the
          // response payload. The mock returns a minimal
          // rider shape with the included relations;
          // the test only checks status codes here.
          findUnique: vi.fn().mockResolvedValue({
            id: 'r1',
            kycProfile: {},
            wallet: {},
            guarantor: {},
          }),
        },
        guarantor: {
          findUnique: mocks.guarantorFindUnique,
          upsert: mocks.guarantorUpsert,
        },
        kycProfile: {
          findUnique: mocks.kycProfileFindUnique,
          upsert: mocks.kycProfileUpsert,
        },
      };
      return cb(tx);
    });
    mocks.riderUpdate.mockResolvedValue({});
    mocks.kycProfileFindUnique.mockResolvedValue({ status: 'PENDING' });
    mocks.kycProfileUpsert.mockResolvedValue({});
    mocks.guarantorFindUnique.mockResolvedValue({ status: 'DRAFT' });
    mocks.guarantorUpsert.mockResolvedValue({});
    mocks.promoteToApproved.mockResolvedValue(undefined);
    mocks.promoteToRejected.mockResolvedValue(undefined);
    mocks.promoteToInfoRequired.mockResolvedValue(undefined);
    mocks.outboxEmit.mockResolvedValue(undefined);
  });

  // ---------- 19a-1: lifecycleStatus validation ----------

  it('rejects lifecycleStatus write that violates the state machine (NEW → ACTIVE)', async () => {
    // The state machine does not allow NEW → ACTIVE
    // directly. The pre-fix code wrote it anyway.
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'NEW',
    });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { lifecycleStatus: 'ACTIVE' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toBeInstanceOf(RiderLifecycleError);

    // The transaction is opened (validation runs
    // inside the tx body) but the rider write never
    // happens — the validateTransition throw aborts
    // the transaction.
    expect(mocks.transaction).toHaveBeenCalled();
    expect(mocks.riderUpdate).not.toHaveBeenCalled();
  });

  it('allows lifecycleStatus write that follows the state machine (PICKUP_SCHEDULED → ACTIVE)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'PICKUP_SCHEDULED',
    });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { lifecycleStatus: 'ACTIVE' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });

  it('allows lifecycleStatus write that is a no-op (PICKUP_SCHEDULED → PICKUP_SCHEDULED)', async () => {
    // No-op transitions are explicitly allowed by
    // `validateTransition` (line 97-99).
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'PICKUP_SCHEDULED',
    });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { lifecycleStatus: 'PICKUP_SCHEDULED' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });

  it('rejects bulk Suspend from a state where SUSPENDED is not in the allowed set (the documented trade-off)', async () => {
    // Per the follow-up-19 plan: bulk Suspend goes
    // through `update()` with `lifecycleStatus:
    // 'SUSPENDED'`. The state machine only allows
    // SUSPENDED from GUARANTOR_SUBMITTED,
    // DEPOSIT_PENDING, KYC_SUBMITTED. From
    // PICKUP_SCHEDULED, suspend is not in the
    // allowed set — the update() now 409s. The
    // bulk Suspend needs a dedicated use-case (a
    // follow-up). This test locks the new
    // behavior so a future refactor that
    // re-allows suspend-from-anywhere is a
    // conscious decision.
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'PICKUP_SCHEDULED',
    });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { lifecycleStatus: 'SUSPENDED' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toBeInstanceOf(RiderLifecycleError);
  });

  it('allows lifecycleStatus no-write (the body has no lifecycleStatus key)', async () => {
    // Regression lock: the validation is gated on
    // `if (riderData.lifecycleStatus)`, so an
    // update that doesn't touch lifecycle still
    // works.
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'NEW',
    });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { fullName: 'New Name' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });

  // ---------- 19b: guarantorStatus validation ----------

  it('rejects guarantorStatus write that violates the state machine (DRAFT → APPROVED)', async () => {
    // The pre-fix code wrote any guarantorStatus
    // directly. The state machine only allows
    // DRAFT → SUBMITTED (then SUBMITTED → APPROVED).
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'KYC_APPROVED',
    });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { guarantorStatus: 'APPROVED' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toBeInstanceOf(GuarantorStateError);
  });

  it('allows guarantorStatus write that follows the state machine (SUBMITTED → APPROVED)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'KYC_APPROVED',
    });
    mocks.guarantorFindUnique.mockResolvedValue({ status: 'SUBMITTED' });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { guarantorStatus: 'APPROVED' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });

  it('does NOT clobber an APPROVED guarantor with REJECTED on KYC rejection (the documented bug)', async () => {
    // Per the user's flag: "Combined with the
    // KYC-audit finding (reject clobbers an
    // APPROVED guarantor)". The pre-fix code at
    // line 575 did `guarantorData.status =
    // 'REJECTED'` as a side effect of KYC
    // rejection, clobbering any existing guarantor
    // status. The fix is two-layered:
    //   1. The KYC side-effect only sets
    //      guarantorData.status when the current
    //      guarantor is SUBMITTED (the only state
    //      from which both REJECTED and
    //      INFO_REQUIRED are valid transitions).
    //      APPROVED → REJECTED is invalid, so the
    //      side-effect doesn't fire.
    //   2. The validateGuarantorTransition guard
    //      inside the transaction catches any
    //      future code that DOES try to write
    //      APPROVED → REJECTED.
    // The test pins the new behavior: the call
    // resolves successfully (no clobber) AND the
    // guarantor's status was not changed.
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.kycProfileFindUnique.mockResolvedValue({ status: 'SUBMITTED' });
    mocks.guarantorFindUnique.mockResolvedValue({ status: 'APPROVED' });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { kycStatus: 'REJECTED', rejectionReason: 'Aadhaar blurry' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();

    // The guarantor upsert was called (kyc was rejected)
    // BUT NOT with a status change. The side-effect
    // for the KYC reject skipped because the guarantor
    // was APPROVED.
    const upsertCalls = mocks.guarantorUpsert.mock.calls;
    if (upsertCalls.length > 0) {
      const updateArg = upsertCalls[0][1] as { status?: string };
      expect(updateArg.status).toBeUndefined();
    }
  });

  it('does NOT clobber a DRAFT guarantor with REJECTED on KYC rejection (no guarantor to reject)', async () => {
    // The KYC reject side-effect should be a
    // no-op when there's no guarantor submitted
    // (DRAFT). Pre-fix: the side-effect wrote
    // REJECTED anyway, creating a REJECTED row
    // out of thin air. Post-fix: the side-effect
    // is gated on the current being SUBMITTED.
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.kycProfileFindUnique.mockResolvedValue({ status: 'SUBMITTED' });
    // No guarantor row exists.
    mocks.guarantorFindUnique.mockResolvedValue(null);

    await expect(
      adminRiderUseCases.update(
        'r1',
        { kycStatus: 'REJECTED', rejectionReason: 'Aadhaar blurry' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();

    // The guarantor upsert was called (kyc was rejected)
    // BUT NOT with a status change. The side-effect
    // for the KYC reject skipped because the guarantor
    // was DRAFT (null).
    const upsertCalls = mocks.guarantorUpsert.mock.calls;
    if (upsertCalls.length > 0) {
      const updateArg = upsertCalls[0][1] as { status?: string };
      expect(updateArg.status).toBeUndefined();
    }
  });

  it('allows KYC-approve side-effect when guarantor is SUBMITTED (the supported auto-approve flow)', async () => {
    // The KYC-approve branch at line 545-547
    // auto-sets guarantorData.status = 'APPROVED'
    // when the current guarantor status is
    // SUBMITTED. The state machine allows
    // SUBMITTED → APPROVED. After the fix, this
    // path still works.
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-0001',
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.kycProfileFindUnique.mockResolvedValue({ status: 'SUBMITTED' });
    mocks.guarantorFindUnique.mockResolvedValue({ status: 'SUBMITTED' });

    await expect(
      adminRiderUseCases.update(
        'r1',
        { kycStatus: 'APPROVED' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });

  // ---------- state-machine sanity (pure functions) ----------

  it('validateTransition: PICKUP_SCHEDULED → SUSPENDED is rejected (lock for the bulk Suspend trade-off)', () => {
    expect(() => validateTransition('PICKUP_SCHEDULED', 'SUSPENDED')).toThrow(
      RiderLifecycleError
    );
  });

  it('validateTransition: GUARANTOR_SUBMITTED → SUSPENDED is allowed (the legal suspend path)', () => {
    expect(() => validateTransition('GUARANTOR_SUBMITTED', 'SUSPENDED')).not.toThrow();
  });

  it('validateTransition: CLOSED → ACTIVE is allowed (GDPR restore path, the new transition added in follow-up-19)', () => {
    expect(() => validateTransition('CLOSED', 'ACTIVE')).not.toThrow();
  });

  it('validateGuarantorTransition: DRAFT → APPROVED is rejected', () => {
    expect(() => validateGuarantorTransition('DRAFT', 'APPROVED')).toThrow(
      GuarantorStateError
    );
  });

  it('validateGuarantorTransition: APPROVED → REJECTED is rejected (the "reject clobbers APPROVED" bug)', () => {
    expect(() => validateGuarantorTransition('APPROVED', 'REJECTED')).toThrow(
      GuarantorStateError
    );
  });
});
