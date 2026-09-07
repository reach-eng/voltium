import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { promoteToApproved } from '@/server/modules/kyc/kyc.repository';

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

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
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
