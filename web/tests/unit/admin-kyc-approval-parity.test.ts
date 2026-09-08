/**
 * KYC Approval Parity Tests (Phase 1 / P0-1 Audit Fix)
 *
 * Verifies that approving KYC via the live UI write path
 * (`adminRiderUseCases.update` -> `PUT /api/admin/riders`)
 * and via the dedicated KYC approval use case
 * (`approveKyc` -> `POST /api/admin/kyc`)
 * produce identical post-conditions:
 *   1. kycProfile.status === 'APPROVED'
 *   2. kycProfile.editableFields === [] (profile locked)
 *   3. kycProfile.expiresAt === now + 365d (daily sweep horizon)
 *   4. kycProfile.pendingCorrections === DbNull (held values cleared)
 *   5. rider.kycDoneAt === timestamped
 *   6. rider.lifecycleStatus promoted only for ranks 0..3 (NEW through KYC_SUBMITTED),
 *      preserving higher ranks (4..14: GUARANTOR_*, ACTIVE, etc.)
 *   7. Staged corrections in pendingCorrections applied to Rider/KycProfile
 *   8. Outbox event NOTIFICATION_SEND with type 'KYC_APPROVED' emitted
 *   9. Audit log entry with action 'kyc.approved' recorded
 *  10. Precondition failures: both paths reject approval from DRAFT/PENDING
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { approveKyc } from '@/server/modules/kyc/use-cases/approveKyc';
import { KycApproveError } from '@/server/modules/kyc/use-cases/errors';
import { LOWER_THAN_KYC_APPROVED } from '@/server/modules/kyc/kyc.repository';

// ---------------------------------------------------------------------------
// Hoisted Mocks
// ---------------------------------------------------------------------------

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  updateMany: vi.fn(),
  upsert: vi.fn(),
  transaction: vi.fn(),
  guarantorFindUnique: vi.fn(),
  getCachedRider: vi.fn((_id, fn) => fn()),
  invalidateRiderCache: vi.fn(),
  auditLog: vi.fn().mockResolvedValue(undefined),
  outboxEmit: vi.fn().mockResolvedValue(undefined),
  kycFindByRiderId: vi.fn(),
  kycApproveKyc: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      updateMany: mocks.updateMany,
    },
    kycProfile: {
      findUnique: mocks.findUnique,
      update: mocks.update,
      upsert: mocks.upsert,
    },
    guarantor: {
      findUnique: mocks.guarantorFindUnique,
      upsert: mocks.upsert,
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
  createAuditLog: mocks.auditLog,
  getExpiresAt: (action: string) => {
    const d = new Date();
    d.setDate(d.getDate() + 365);
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

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: {
    emit: mocks.outboxEmit,
  },
  OutboxEventTypes: {
    NOTIFICATION_SEND: 'NOTIFICATION_SEND',
  },
}));

describe('KYC Approval Parity: adminRiderUseCases.update vs approveKyc', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function createTxMock(options: { pendingCorrections?: any } = {}) {
    const kycUpdates: any[] = [];
    const riderUpdates: any[] = [];
    const riderUpdateManys: any[] = [];

    const tx = {
      rider: {
        update: vi.fn().mockImplementation(async (args) => {
          riderUpdates.push(args);
          return {};
        }),
        updateMany: vi.fn().mockImplementation(async (args) => {
          riderUpdateManys.push(args);
          return { count: 1 };
        }),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'SUBMITTED' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: {
        upsert: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockImplementation(async (args) => {
          kycUpdates.push(args);
          return {};
        }),
        findUnique: vi.fn().mockImplementation(async () => ({
          id: 'kp1',
          status: 'SUBMITTED',
          pendingCorrections: options.pendingCorrections ?? null,
        })),
      },
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'w1', balanceInPaise: 0 }),
        update: vi.fn().mockResolvedValue({}),
      },
      guarantor: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    };

    return { tx, kycUpdates, riderUpdates, riderUpdateManys };
  }

  // -------------------------------------------------------------------------
  // 1. Core Post-conditions Parity on Happy Path (KYC_SUBMITTED)
  // -------------------------------------------------------------------------
  it('both paths produce identical post-conditions on SUBMITTED KYC approval', async () => {
    // ── 1. Path A: adminRiderUseCases.update (PUT /api/admin/riders) ───────
    mocks.findUnique.mockResolvedValue({
      id: 'rider-A',
      riderId: 'RD-001',
      serialNumber: 1,
      lifecycleStatus: 'KYC_SUBMITTED',
      kycProfile: { status: 'SUBMITTED' },
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);

    const txA = createTxMock();
    mocks.transaction.mockImplementation(async (fn: any) => fn(txA.tx));

    await adminRiderUseCases.update(
      'rider-A',
      { kycStatus: 'APPROVED' },
      { actorId: 'admin-1', actorRole: 'ADMIN' }
    );

    // ── 2. Path B: approveKyc (POST /api/admin/kyc) ────────────────────────
    mocks.findUnique.mockResolvedValue({
      id: 'kp-B',
      riderId: 'rider-B',
      status: 'SUBMITTED',
    });

    const txB = createTxMock();
    mocks.transaction.mockImplementation(async (fn: any) => fn(txB.tx));

    await approveKyc('rider-B', 'admin-1');

    // ── Parity Assertions ──────────────────────────────────────────────────

    // 1. kycProfile.update: status === 'APPROVED'
    const mainWriteA = txA.kycUpdates[txA.kycUpdates.length - 1];
    const mainWriteB = txB.kycUpdates[txB.kycUpdates.length - 1];

    expect(mainWriteA.data.status).toBe('APPROVED');
    expect(mainWriteB.data.status).toBe('APPROVED');

    // 2. editableFields === [] (profile locked)
    expect(mainWriteA.data.editableFields).toEqual([]);
    expect(mainWriteB.data.editableFields).toEqual([]);

    // 3. expiresAt === now + 365d (within 5s clock tolerance)
    const now = Date.now();
    const expectedExpiryMs = 365 * 24 * 60 * 60 * 1000;

    expect(mainWriteA.data.expiresAt).toBeInstanceOf(Date);
    expect(mainWriteB.data.expiresAt).toBeInstanceOf(Date);

    const diffA = Math.abs(mainWriteA.data.expiresAt.getTime() - (now + expectedExpiryMs));
    const diffB = Math.abs(mainWriteB.data.expiresAt.getTime() - (now + expectedExpiryMs));
    expect(diffA).toBeLessThan(5000);
    expect(diffB).toBeLessThan(5000);

    // 4. pendingCorrections === Prisma.DbNull
    expect(mainWriteA.data.pendingCorrections).toBe(Prisma.DbNull);
    expect(mainWriteB.data.pendingCorrections).toBe(Prisma.DbNull);

    // 5. rider.kycDoneAt === timestamped Date
    expect(txA.riderUpdates[0].data.kycDoneAt).toBeInstanceOf(Date);
    expect(txB.riderUpdates[0].data.kycDoneAt).toBeInstanceOf(Date);

    // 6. rider.lifecycleStatus promoted with LOWER_THAN_KYC_APPROVED filter
    expect(txA.riderUpdateManys[0].data.lifecycleStatus).toBe('KYC_APPROVED');
    expect(txB.riderUpdateManys[0].data.lifecycleStatus).toBe('KYC_APPROVED');
    expect(txA.riderUpdateManys[0].where.lifecycleStatus.in).toEqual(LOWER_THAN_KYC_APPROVED);
    expect(txB.riderUpdateManys[0].where.lifecycleStatus.in).toEqual(LOWER_THAN_KYC_APPROVED);

    // 7. Outbox event NOTIFICATION_SEND with KYC_APPROVED emitted by both
    expect(mocks.outboxEmit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      { riderId: 'rider-A', type: 'KYC_APPROVED' },
      3,
      txA.tx,
      'interactive'
    );
    expect(mocks.outboxEmit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      { riderId: 'rider-B', type: 'KYC_APPROVED' },
      3,
      undefined,
      'interactive'
    );

    // 8. Audit log kyc.approved recorded by both
    expect(mocks.auditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'kyc.approved',
        actorId: 'admin-1',
      })
    );
  });

  // -------------------------------------------------------------------------
  // 2. Lifecycle Protection Parity (Rank >= 4: GUARANTOR_SUBMITTED, ACTIVE)
  // -------------------------------------------------------------------------
  it('both paths preserve lifecycleStatus for riders at rank >= 4 (F-06)', async () => {
    // Both paths use the atomic `updateMany` with `where: { lifecycleStatus: { in: LOWER_THAN_KYC_APPROVED } }`.
    // Verify that higher ranks (e.g., GUARANTOR_SUBMITTED, PLAN_SELECTED, ACTIVE)
    // are strictly excluded from the update condition on both paths.
    expect(LOWER_THAN_KYC_APPROVED).toContain('NEW');
    expect(LOWER_THAN_KYC_APPROVED).toContain('PHONE_VERIFIED');
    expect(LOWER_THAN_KYC_APPROVED).toContain('PROFILE_SUBMITTED');
    expect(LOWER_THAN_KYC_APPROVED).toContain('KYC_SUBMITTED');

    expect(LOWER_THAN_KYC_APPROVED).not.toContain('GUARANTOR_SUBMITTED');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('GUARANTOR_APPROVED');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('DEPOSIT_SUBMITTED');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('DEPOSIT_APPROVED');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('PLAN_SELECTED');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('PICKUP_SCHEDULED');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('ACTIVE');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('SUSPENDED');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('RETURN_PENDING');
    expect(LOWER_THAN_KYC_APPROVED).not.toContain('CLOSED');
  });

  // -------------------------------------------------------------------------
  // 3. Staged Corrections Parity (applyPendingCorrections)
  // -------------------------------------------------------------------------
  it('both paths apply held corrections to Rider and KycProfile tables and clear pendingCorrections', async () => {
    const stagedCorrections = {
      values: {
        fullName: 'New Legal Name',
        panCard: 'https://cdn.voltium.io/pan-new.jpg',
      },
      submittedAt: new Date().toISOString(),
    };

    // Path A
    mocks.findUnique.mockResolvedValue({
      id: 'rider-A',
      riderId: 'RD-001',
      lifecycleStatus: 'KYC_SUBMITTED',
      kycProfile: { status: 'SUBMITTED' },
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);

    const txA = createTxMock({ pendingCorrections: stagedCorrections });
    mocks.transaction.mockImplementation(async (fn: any) => fn(txA.tx));

    await adminRiderUseCases.update(
      'rider-A',
      { kycStatus: 'APPROVED' },
      { actorId: 'admin-1', actorRole: 'ADMIN' }
    );

    // Path B
    mocks.findUnique.mockResolvedValue({
      id: 'kp-B',
      riderId: 'rider-B',
      status: 'SUBMITTED',
    });

    const txB = createTxMock({ pendingCorrections: stagedCorrections });
    mocks.transaction.mockImplementation(async (fn: any) => fn(txB.tx));

    await approveKyc('rider-B', 'admin-1');

    // Both paths must apply the rider-level column (fullName) to rider.update
    const riderCorrectionA = txA.riderUpdates.find((u) => u.data.fullName === 'New Legal Name');
    const riderCorrectionB = txB.riderUpdates.find((u) => u.data.fullName === 'New Legal Name');
    expect(riderCorrectionA).toBeDefined();
    expect(riderCorrectionB).toBeDefined();

    // Both paths must apply the KYC-level column (panCard) to kycProfile.update
    const kycCorrectionA = txA.kycUpdates.find((u) => u.data.panCard === 'https://cdn.voltium.io/pan-new.jpg');
    const kycCorrectionB = txB.kycUpdates.find((u) => u.data.panCard === 'https://cdn.voltium.io/pan-new.jpg');
    expect(kycCorrectionA).toBeDefined();
    expect(kycCorrectionB).toBeDefined();

    // Both paths clear pendingCorrections
    expect(txA.kycUpdates[txA.kycUpdates.length - 1].data.pendingCorrections).toBe(Prisma.DbNull);
    expect(txB.kycUpdates[txB.kycUpdates.length - 1].data.pendingCorrections).toBe(Prisma.DbNull);
  });

  // -------------------------------------------------------------------------
  // 4. Precondition Rejection Parity (Cannot approve from DRAFT or PENDING)
  // -------------------------------------------------------------------------
  it('both paths reject approving when KYC status is DRAFT or PENDING', async () => {
    // Path A: adminRiderUseCases.update throws on illegal state transition
    mocks.findUnique.mockResolvedValue({
      id: 'rider-A',
      riderId: 'RD-001',
      lifecycleStatus: 'NEW',
      kycProfile: { status: 'PENDING' },
    });
    const txA = createTxMock();
    txA.tx.kycProfile.findUnique.mockResolvedValue({ id: 'kp1', status: 'PENDING' });
    mocks.transaction.mockImplementation(async (fn: any) => fn(txA.tx));

    await expect(
      adminRiderUseCases.update(
        'rider-A',
        { kycStatus: 'APPROVED' },
        { actorId: 'admin-1', actorRole: 'ADMIN' }
      )
    ).rejects.toThrow();

    // Path B: approveKyc throws KycApproveError when not in SUBMITTED
    mocks.findUnique.mockResolvedValue({
      id: 'kp-B',
      riderId: 'rider-B',
      status: 'DRAFT',
    });

    await expect(approveKyc('rider-B', 'admin-1')).rejects.toThrow(KycApproveError);
  });

  // -------------------------------------------------------------------------
  // 5. Outbox Notification Dispatch Parity: KYC_REJECTED (P1-5)
  // -------------------------------------------------------------------------
  it('adminRiderUseCases.update emits NOTIFICATION_SEND outbox event for KYC_REJECTED with reason', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'rider-rej',
      riderId: 'RD-002',
      serialNumber: 2,
      lifecycleStatus: 'KYC_SUBMITTED',
      kycProfile: { status: 'SUBMITTED' },
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);

    const txRej = createTxMock();
    mocks.transaction.mockImplementation(async (fn: any) => fn(txRej.tx));

    await adminRiderUseCases.update(
      'rider-rej',
      {
        kycStatus: 'REJECTED',
        rejectionReason: 'Aadhaar photo is blurry',
        editableFields: ['aadhaarFront'],
      },
      { actorId: 'admin-1', actorRole: 'ADMIN' }
    );

    expect(mocks.outboxEmit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      {
        riderId: 'rider-rej',
        type: 'KYC_REJECTED',
        reason: 'Aadhaar photo is blurry',
      },
      3,
      txRej.tx,
      'interactive'
    );
  });

  // -------------------------------------------------------------------------
  // 6. Outbox Notification Dispatch Parity: KYC_INFO_REQUESTED (P1-5)
  // -------------------------------------------------------------------------
  it('adminRiderUseCases.update emits NOTIFICATION_SEND outbox event for KYC_INFO_REQUESTED with infoRequest', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'rider-info',
      riderId: 'RD-003',
      serialNumber: 3,
      lifecycleStatus: 'KYC_SUBMITTED',
      kycProfile: { status: 'SUBMITTED' },
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);

    const txInfo = createTxMock();
    mocks.transaction.mockImplementation(async (fn: any) => fn(txInfo.tx));

    await adminRiderUseCases.update(
      'rider-info',
      {
        kycStatus: 'INFO_REQUIRED',
        rejectionReason: 'Please re-upload back of PAN',
        editableFields: ['panCard'],
      },
      { actorId: 'admin-1', actorRole: 'ADMIN' }
    );

    expect(mocks.outboxEmit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      {
        riderId: 'rider-info',
        type: 'KYC_INFO_REQUESTED',
        infoRequest: 'Please re-upload back of PAN',
      },
      3,
      txInfo.tx,
      'interactive'
    );
  });
});

