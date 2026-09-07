import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import {
  promoteToApproved,
  promoteToRejected,
  promoteToInfoRequired,
} from '@/server/modules/kyc/kyc.repository';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
  transaction: vi.fn(),
  guarantorFindUnique: vi.fn(),
  getCachedRider: vi.fn((_id, fn) => fn()),
  invalidateRiderCache: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.update,
    },
    guarantor: {
      findUnique: mocks.guarantorFindUnique,
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
  invalidateCache: vi.fn(),
  getOrSetResponse: vi.fn(async (_key, fn) => fn()),
}));

vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    notifyKycStatusChange: vi.fn().mockResolvedValue(undefined),
  },
}));

const auditLogMocks = vi.hoisted(() => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: auditLogMocks.createAuditLog,
  // The tests below only care about the createAuditLog
  // call shape, not the retention lookup. Returning
  // unchanged keeps the test simple.
  getExpiresAt: (action: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 90);
    return d;
  },
}));

vi.mock('@/lib/security-events', () => ({
  logAccountSuspension: vi.fn(),
}));

vi.mock('@/lib/flatten-rider', () => ({
  flattenRider: vi.fn((r) => r),
}));

vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: {
    credit: vi.fn(),
    debit: vi.fn(),
  },
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeText: (v: unknown) => v,
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrlsWithProvider: vi.fn((r) => r),
}));

const outboxMocks = vi.hoisted(() => ({
  emit: vi.fn(),
}));
vi.mock('@/server/workers/outbox', () => ({
  OutboxService: {
    emit: outboxMocks.emit,
  },
  OutboxEventTypes: {
    NOTIFICATION_SEND: 'NOTIFICATION_SEND',
  },
}));

describe('NET-005 (2026-09-08): live admin KYC approval writes the full approval package', () => {
  // The audit's NET-005 finding: the live admin path
  // (admin-riders.use-cases.ts:update) only wrote `status`
  // and `kycDoneAt` when an admin approved KYC. The four
  // other approval writes — `editableFields: []`,
  // `expiresAt: +365d`, `pendingCorrections: DbNull`, and
  // the `applyPendingCorrections` step — lived only in
  // kycRepository.approveKyc (the dead repo path used by
  // kyc.use-cases.ts:reviewKyc). Live-UI-approved KYC never
  // hit the kyc-expiry.job.ts sweep because `expiresAt`
  // stayed null. The fix extracts `promoteToApproved` as a
  // tx-accepting helper and calls it from both surfaces.

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. The helper itself: every approval write must fire.
  it('promoteToApproved writes status, editableFields, expiresAt, and clears pendingCorrections', async () => {
    const tx = {
      kycProfile: {
        update: vi.fn().mockResolvedValue({}),
        // applyPendingCorrections reads `pendingCorrections` to
        // decide what (if anything) to promote. Return null
        // (nothing held) for the cleanest path.
        findUnique: vi.fn().mockResolvedValue({ pendingCorrections: null }),
      },
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await promoteToApproved(tx as any, 'r1');

    // Two `kycProfile.update` calls: applyPendingCorrections
    // sets editableFields+pendingCorrections, then the main
    // write sets status+editableFields+expiresAt+pendingCorrections.
    expect(tx.kycProfile.update).toHaveBeenCalledTimes(2);

    // The main write (the second one) is the one that locks
    // the approval package.
    const mainWrite = tx.kycProfile.update.mock.calls[1][0];
    expect(mainWrite.where).toEqual({ riderId: 'r1' });
    expect(mainWrite.data.status).toBe('APPROVED');
    expect(mainWrite.data.editableFields).toEqual([]);
    // The helper writes `Prisma.DbNull` (the sentinel that
    // Prisma maps to SQL NULL). The use case is "is this
    // field set to the SQL NULL sentinel?" — assert against
    // the sentinel, not against plain JS `null` (which
    // would not match the special value).
    expect(mainWrite.data.pendingCorrections).toBe(Prisma.DbNull);
    const expiresAt: Date = mainWrite.data.expiresAt;
    const expectedWindow = 365 * 24 * 60 * 60 * 1000;
    const actualWindow = expiresAt.getTime() - Date.now();
    // Allow 5s of clock drift between `Date.now()` calls
    expect(Math.abs(actualWindow - expectedWindow)).toBeLessThan(5000);

    // rider.kycDoneAt is set.
    expect(tx.rider.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { kycDoneAt: expect.any(Date) },
    });

    // The F-06 rank guard: only ranks 0..3 get promoted to
    // KYC_APPROVED. The `LOWER_THAN_KYC_APPROVED` set is
    // defined in the repo and includes NEW, PHONE_VERIFIED,
    // PROFILE_SUBMITTED, KYC_SUBMITTED.
    expect(tx.rider.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'r1',
        lifecycleStatus: { in: expect.any(Array) },
      },
      data: { lifecycleStatus: 'KYC_APPROVED' },
    });
    const ranksArg = tx.rider.updateMany.mock.calls[0][0].where
      .lifecycleStatus.in;
    expect(ranksArg).toContain('KYC_SUBMITTED');
    expect(ranksArg).toContain('PROFILE_SUBMITTED');
    expect(ranksArg).not.toContain('ACTIVE');
    expect(ranksArg).not.toContain('SUSPENDED');
  });

  // 2. The use-case integration: the live admin path
  //    delegates to the helper inside its existing
  //    transaction. Before the fix, the use-case only set
  //    `status: 'APPROVED'` + `kycDoneAt`. After the fix,
  //    the use-case calls `promoteToApproved`, which writes
  //    the full package.
  it('adminRiderUseCases.update({ kycStatus: "APPROVED" }) calls promoteToApproved inside the transaction', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    // The transaction body touches many tx.* methods. Mock
    // them all as no-ops so the body runs to completion.
    // We specifically inspect the `kycProfile.update` calls
    // to verify the helper ran.
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'PENDING' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      { kycStatus: 'APPROVED' },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    // The helper fires two `kycProfile.update` calls. The
    // second one (main write) must carry the full approval
    // package — that is the NET-005 fix.
    const kycUpdates = tx.kycProfile.update.mock.calls;
    expect(kycUpdates.length).toBeGreaterThanOrEqual(2);
    const mainWrite = kycUpdates[kycUpdates.length - 1][0];
    expect(mainWrite.data).toMatchObject({
      status: 'APPROVED',
      editableFields: [],
      pendingCorrections: Prisma.DbNull,
    });
    expect(mainWrite.data.expiresAt).toBeInstanceOf(Date);
  });

  // 3. Regression: an admin update that does NOT touch KYC
  //    (e.g., changing the rider's emergencyContact) must
  //    NOT trigger the approval helper. This guards against
  //    the helper firing on every update.
  it('adminRiderUseCases.update({ emergencyContact: "..." }) does NOT call promoteToApproved', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'ACTIVE',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'APPROVED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'APPROVED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      { emergencyContact: '9876543210' },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    // No approval helper fires — kycProfile.update was
    // never called. Only the upsert (which writes the
    // emergencyContact through the rider bucket, not the
    // kyc bucket) is on the wire.
    expect(tx.kycProfile.update).not.toHaveBeenCalled();
  });
});

describe('REJECT symmetry (2026-09-08, follow-up to NET-005)', () => {
  // The audit's NET-005 commit message flagged that the
  // REJECTED / INFO_REQUIRED branch in the live admin path
  // had the same divergence pattern. This suite covers the
  // extracted helpers + the F-12 PRE_ACTIVE_STAGES alignment
  // + the outbox emit symmetry.

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('promoteToRejected writes status=REJECTED, rejectionReason, editableFields, clears pendingCorrections, and runs F-12 SUSPENDED', async () => {
    const tx = {
      kycProfile: {
        update: vi.fn().mockResolvedValue({}),
      },
      rider: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    await promoteToRejected(tx as any, 'r1', 'Photo is blurry', ['profilePhoto']);

    expect(tx.kycProfile.update).toHaveBeenCalledWith({
      where: { riderId: 'r1' },
      data: {
        status: 'REJECTED',
        rejectionReason: 'Photo is blurry',
        editableFields: ['profilePhoto'],
        // F-12 follow-up (2026-09-08): held corrections are
        // cleared on REJECT so the next APPROVE does not
        // silently apply a stale draft on top of the
        // rejection.
        pendingCorrections: Prisma.DbNull,
      },
    });

    // F-12: PRE_ACTIVE_STAGES contains the ranks 0..10
    // (NEW through PICKUP_SCHEDULED). It must NOT contain
    // ACTIVE (rank 11), RETURN_PENDING (rank 13), or
    // CLOSED (rank 14) — those riders keep their current
    // status to avoid abrupt fleet lockout.
    expect(tx.rider.updateMany).toHaveBeenCalledTimes(1);
    const riderUpdate = tx.rider.updateMany.mock.calls[0][0];
    expect(riderUpdate.data).toEqual({ lifecycleStatus: 'SUSPENDED' });
    const stages = riderUpdate.where.lifecycleStatus.in;
    expect(stages).toContain('KYC_SUBMITTED');
    expect(stages).toContain('KYC_APPROVED');
    expect(stages).toContain('GUARANTOR_SUBMITTED');
    expect(stages).toContain('PICKUP_SCHEDULED');
    expect(stages).not.toContain('ACTIVE');
    expect(stages).not.toContain('CLOSED');
  });

  it('promoteToInfoRequired writes status=INFO_REQUIRED and rejectionReason-as-infoRequest (no lifecycle change)', async () => {
    const tx = {
      kycProfile: {
        update: vi.fn().mockResolvedValue({}),
      },
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      },
    };

    await promoteToInfoRequired(
      tx as any,
      'r1',
      'Please re-upload a clearer Aadhaar front'
    );

    expect(tx.kycProfile.update).toHaveBeenCalledWith({
      where: { riderId: 'r1' },
      data: {
        status: 'INFO_REQUIRED',
        rejectionReason: 'Please re-upload a clearer Aadhaar front',
      },
    });
    // INFO_REQUIRED does not touch lifecycle.
    expect(tx.rider.update).not.toHaveBeenCalled();
    expect(tx.rider.updateMany).not.toHaveBeenCalled();
  });

  it('adminRiderUseCases.update({ kycStatus: "REJECTED" }) calls promoteToRejected + emits KYC_REJECTED outbox event', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'SUBMITTED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      {
        kycStatus: 'REJECTED',
        rejectionReason: 'Photo is blurry',
        editableFields: ['profilePhoto'],
      },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    // kycProfile.update is called by the helper.
    const kycUpdates = tx.kycProfile.update.mock.calls;
    expect(kycUpdates.length).toBeGreaterThanOrEqual(1);
    const mainWrite = kycUpdates[kycUpdates.length - 1][0];
    expect(mainWrite.data).toMatchObject({
      status: 'REJECTED',
      rejectionReason: 'Photo is blurry',
      editableFields: ['profilePhoto'],
      // F-12 follow-up (2026-09-08): held corrections
      // cleared on REJECT.
      pendingCorrections: Prisma.DbNull,
    });

    // The F-12 PRE_ACTIVE_STAGES promotion runs.
    expect(tx.rider.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lifecycleStatus: 'SUSPENDED' },
      })
    );

    // Outbox emit fires for KYC_REJECTED.
    expect(outboxMocks.emit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      {
        riderId: 'r1',
        type: 'KYC_REJECTED',
        reason: 'Photo is blurry',
      },
      3,
      tx,
      'interactive'
    );
  });

  it('adminRiderUseCases.update({ kycStatus: "INFO_REQUIRED" }) calls promoteToInfoRequired + emits KYC_INFO_REQUESTED outbox event', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'SUBMITTED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      {
        kycStatus: 'INFO_REQUIRED',
        rejectionReason: 'Re-upload Aadhaar front',
      },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    // kycProfile.update is called by the helper.
    const kycUpdates = tx.kycProfile.update.mock.calls;
    expect(kycUpdates.length).toBeGreaterThanOrEqual(1);
    const mainWrite = kycUpdates[kycUpdates.length - 1][0];
    expect(mainWrite.data).toMatchObject({
      status: 'INFO_REQUIRED',
      rejectionReason: 'Re-upload Aadhaar front',
    });

    // INFO_REQUIRED: NO rider.updateMany for lifecycle
    // promotion (the dead path's `requestInfo` does not
    // touch lifecycle).
    expect(tx.rider.updateMany).not.toHaveBeenCalled();

    // Outbox emit fires for KYC_INFO_REQUESTED.
    expect(outboxMocks.emit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      {
        riderId: 'r1',
        type: 'KYC_INFO_REQUESTED',
        infoRequest: 'Re-upload Aadhaar front',
      },
      3,
      tx,
      'interactive'
    );
  });

  it('adminRiderUseCases.update({ kycStatus: "APPROVED" }) emits KYC_APPROVED outbox event (outbox symmetry)', async () => {
    // The existing NET-005 test already covers the helper
    // call. This one specifically checks the outbox emit
    // (the audit's outbox-symmetry recommendation).
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'SUBMITTED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      { kycStatus: 'APPROVED' },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    expect(outboxMocks.emit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      { riderId: 'r1', type: 'KYC_APPROVED' },
      3,
      tx,
      'interactive'
    );
  });
});

describe('NET-005 follow-up-3 (2026-09-08): audit-trail action strings use the dot-separated form', () => {
  // The audit-trail drift finding: the live admin path
  // wrote `kyc_${status.toLowerCase()}` (underscore) and
  // the expiry job wrote `KYC_EXPIRED` (uppercase, no
  // separator). The retention table in
  // `lib/audit-log.ts:5-27` splits on `.` and looks up the
  // prefix; both formats split to a single segment that
  // does not match the `kyc` key, falling through to the
  // 90-day default instead of the 365-day KYC retention.
  // The dead path's `kycRepository.approveKyc` and
  // `kyc.use-cases.ts:reviewKyc` both write the
  // dot-separated form (`kyc.approved` / `kyc.rejected`);
  // the fix aligns the live path + the expiry job.

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('adminRiderUseCases.update({ kycStatus: "APPROVED" }) writes audit log with action="kyc.approved"', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'SUBMITTED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      { kycStatus: 'APPROVED' },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    expect(auditLogMocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kyc.approved',
        entity: 'rider',
        entityId: 'r1',
      })
    );
  });

  it('adminRiderUseCases.update({ kycStatus: "REJECTED" }) writes audit log with action="kyc.rejected"', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'SUBMITTED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      {
        kycStatus: 'REJECTED',
        rejectionReason: 'Photo is blurry',
      },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    expect(auditLogMocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kyc.rejected',
      })
    );
  });

  it('adminRiderUseCases.update({ kycStatus: "INFO_REQUIRED" }) writes audit log with action="kyc.info_required"', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'SUBMITTED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'SUBMITTED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      {
        kycStatus: 'INFO_REQUIRED',
        rejectionReason: 'Re-upload Aadhaar front',
      },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    expect(auditLogMocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kyc.info_required',
      })
    );
  });

  it('non-KYC admin update does NOT write a kyc.* audit log', async () => {
    // Regression: the audit-log write is guarded by the
    // `kycData.status && ['APPROVED', 'REJECTED',
    // 'INFO_REQUIRED'].includes(...)` check. An update that
    // only touches rider fields (e.g., emergencyContact)
    // must not write a `kyc.*` audit row.
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-001',
      serialNumber: 1,
      lifecycleStatus: 'ACTIVE',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'APPROVED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({ status: 'APPROVED' }),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      { emergencyContact: '9876543210' },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    expect(auditLogMocks.createAuditLog).not.toHaveBeenCalled();
  });
});
