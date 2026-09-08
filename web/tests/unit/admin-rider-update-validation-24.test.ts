/**
 * NET-005 follow-up-24 (2026-09-08):
 * application-level validation for
 * `assignedVehicle`, `teamLeaderId`,
 * `referralCode`, `planStartDate/EndDate` and
 * the phone-lookup-cache invalidation in
 * `adminRiderUseCases.update()`.
 *
 * The pre-fix `update()` wrote these fields
 * straight to the rider row with NO
 * application-level validation. The DB-level FK
 * on `teamLeaderId` and the @unique on
 * `referralCode` would catch the most egregious
 * cases, but they'd surface as 500s (Prisma
 * throws on constraint violation) instead of a
 * clean 400. `assignedVehicle` has no DB-level
 * constraint at all — the column is a free string,
 * so a typo or stale id would silently land in the
 * DB. The phone cache was also never invalidated
 * on update, so a phone change left stale entries
 * in `getCachedRiderByPhone` (the old phone still
 * cached as "rider exists"; the new phone still
 * cached as "rider does not exist" until the TTL).
 *
 * The fix:
 * - `assignedVehicle`: look up the vehicle by
 *   `vehicleId` or `vehicleNumber`; throw if not
 *   found.
 * - `teamLeaderId`: look up the team leader;
 *   throw if not found or not active.
 * - `referralCode`: look up OTHER riders with the
 *   same code; throw if any exist (the @unique
 *   is the DB-level safety net, but the application
 *   check gives a clean 400).
 * - `planStartDate` / `planEndDate`: throw if
 *   end < start.
 * - `phone`: after the tx, invalidate both the
 *   old and new phone keys.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  riderFindUnique: vi.fn(),
  riderFindFirst: vi.fn(),
  riderUpdate: vi.fn(),
  vehicleFindFirst: vi.fn(),
  teamLeaderFindUnique: vi.fn(),
  walletFindUnique: vi.fn(),
  walletCreate: vi.fn(),
  kycProfileFindUnique: vi.fn(),
  kycProfileUpsert: vi.fn(),
  guarantorFindUnique: vi.fn(),
  guarantorUpsert: vi.fn(),
  transaction: vi.fn(),
  getCachedRider: vi.fn((_id: unknown, fn: () => unknown) => fn()),
  invalidateRiderCache: vi.fn(),
  invalidateRiderPhoneCache: vi.fn(),
  createAuditLog: vi.fn().mockResolvedValue(undefined),
  outboxEmit: vi.fn(),
  promoteToApproved: vi.fn(),
  promoteToRejected: vi.fn(),
  promoteToInfoRequired: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.riderFindUnique,
      findFirst: mocks.riderFindFirst,
      update: mocks.riderUpdate,
    },
    vehicle: {
      findFirst: mocks.vehicleFindFirst,
    },
    teamLeader: {
      findUnique: mocks.teamLeaderFindUnique,
    },
    wallet: {
      findUnique: mocks.walletFindUnique,
      create: mocks.walletCreate,
    },
    kycProfile: {
      findUnique: mocks.kycProfileFindUnique,
      upsert: mocks.kycProfileUpsert,
    },
    guarantor: {
      findUnique: mocks.guarantorFindUnique,
      upsert: mocks.guarantorUpsert,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: mocks.getCachedRider,
  invalidateRiderCache: mocks.invalidateRiderCache,
  invalidateRiderPhoneCache: mocks.invalidateRiderPhoneCache,
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
  getExpiresAt: () => new Date(Date.now() + 90 * 86400000),
}));

vi.mock('@/lib/security-events', () => ({
  logAccountSuspension: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/feature-flags', () => ({
  getFeatureFlags: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/sanitize', () => ({
  sanitizeText: (v: unknown) => v,
}));

vi.mock('@/lib/flatten-rider', () => ({
  flattenRider: vi.fn((r: unknown) => r),
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

const baseRider = {
  id: 'r1',
  riderId: 'VEMXX001',
  serialNumber: 1,
  lifecycleStatus: 'KYC_APPROVED',
  phone: '9999999999',
  kycProfile: { status: 'SUBMITTED' },
  wallet: { balanceInPaise: 0 },
  guarantor: null,
  leases: [],
};

const setupHappyPath = () => {
  mocks.transaction.mockImplementation(async (cb: any) => {
    const tx = {
      rider: { findUnique: mocks.riderFindUnique, update: mocks.riderUpdate },
      wallet: { findUnique: mocks.walletFindUnique, create: mocks.walletCreate },
      kycProfile: { findUnique: mocks.kycProfileFindUnique, upsert: mocks.kycProfileUpsert },
      guarantor: { findUnique: mocks.guarantorFindUnique, upsert: mocks.guarantorUpsert },
    };
    return cb(tx);
  });
  mocks.riderUpdate.mockResolvedValue({});
  mocks.kycProfileFindUnique.mockResolvedValue({ status: 'SUBMITTED' });
  mocks.kycProfileUpsert.mockResolvedValue({});
  mocks.guarantorFindUnique.mockResolvedValue(null);
  mocks.guarantorUpsert.mockResolvedValue({});
  mocks.walletFindUnique.mockResolvedValue({ id: 'w1', balanceInPaise: 0 });
  mocks.riderFindUnique.mockResolvedValue(baseRider);
  // No referralCode conflict by default — other
  // test groups don't pass `referralCode` to
  // `update()`, so the use-case's findFirst is
  // never reached. But keep a safe default in
  // case the field creeps in.
  mocks.riderFindFirst.mockResolvedValue(null);
};

describe('NET-005 follow-up-24: assignedVehicle FK validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it('accepts an assignedVehicle that matches a vehicle by vehicleId', async () => {
    mocks.vehicleFindFirst.mockResolvedValue({
      id: 'v1',
      vehicleNumber: 'VF-001',
    });
    await expect(
      adminRiderUseCases.update(
        'r1',
        { assignedVehicle: 'VF-001' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
    expect(mocks.vehicleFindFirst).toHaveBeenCalled();
  });

  it('rejects an assignedVehicle that does not match any known vehicle', async () => {
    // No vehicle matches.
    mocks.vehicleFindFirst.mockResolvedValue(null);
    await expect(
      adminRiderUseCases.update(
        'r1',
        { assignedVehicle: 'VF-DOES-NOT-EXIST' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toThrow(
      /assignedVehicle.*does not match any known vehicle/
    );
    // The DB write never happened — the validation
    // short-circuits before the tx.
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('skips the validation when assignedVehicle is null (a clear-off write)', async () => {
    // Pre-fix: writing `assignedVehicle: null` was
    // fine. Post-fix: same — null means "no
    // assignment" and shouldn't trigger the FK
    // check.
    await expect(
      adminRiderUseCases.update(
        'r1',
        { assignedVehicle: null },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
    expect(mocks.vehicleFindFirst).not.toHaveBeenCalled();
  });
});

describe('NET-005 follow-up-24: teamLeaderId FK validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it('accepts an active teamLeaderId', async () => {
    mocks.teamLeaderFindUnique.mockResolvedValue({
      id: 'tl-1',
      isActive: true,
    });
    await expect(
      adminRiderUseCases.update(
        'r1',
        { teamLeaderId: 'tl-1' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });

  it('rejects a teamLeaderId that does not match any known team leader', async () => {
    mocks.teamLeaderFindUnique.mockResolvedValue(null);
    await expect(
      adminRiderUseCases.update(
        'r1',
        { teamLeaderId: 'tl-ghost' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toThrow(
      /teamLeaderId.*does not match any known team leader/
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('rejects a teamLeaderId that refers to an inactive team leader', async () => {
    // The rider-app flow checks `isActive` before
    // assignment; the admin update path previously
    // skipped that check.
    mocks.teamLeaderFindUnique.mockResolvedValue({
      id: 'tl-1',
      isActive: false,
    });
    await expect(
      adminRiderUseCases.update(
        'r1',
        { teamLeaderId: 'tl-1' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toThrow(/refers to an inactive team leader/);
  });

  it('skips the validation when teamLeaderId is null (a clear-off write)', async () => {
    await expect(
      adminRiderUseCases.update(
        'r1',
        { teamLeaderId: null },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
    expect(mocks.teamLeaderFindUnique).not.toHaveBeenCalled();
  });
});

describe('NET-005 follow-up-24: referralCode uniqueness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it('accepts a referralCode that no other rider uses', async () => {
    // The use-case calls
    // `db.rider.findFirst({ where: { referralCode, NOT: { id } } })`
    // for the conflict check. Setup: existing
    // fetch resolves, then the findFirst conflict
    // check returns null (no other rider uses
    // this code).
    mocks.riderFindUnique.mockResolvedValue(baseRider);
    mocks.riderFindFirst.mockResolvedValue(null);
    await expect(
      adminRiderUseCases.update(
        'r1',
        { referralCode: 'VFR-NEW-1' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });

  it('rejects a referralCode already used by another rider (clean 400, not Prisma 500)', async () => {
    mocks.riderFindUnique.mockResolvedValue(baseRider);
    mocks.riderFindFirst.mockResolvedValue({
      // The conflict check returns a real row.
      id: 'r2',
      riderId: 'VEMXX002',
    });
    await expect(
      adminRiderUseCases.update(
        'r1',
        { referralCode: 'VFR-TAKEN' },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toThrow(
      /referralCode.*already in use by rider VEMXX002/
    );
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});

describe('NET-005 follow-up-24: planStartDate/EndDate range', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it('rejects planEndDate < planStartDate', async () => {
    await expect(
      adminRiderUseCases.update(
        'r1',
        {
          planStartDate: '2026-09-10T00:00:00.000Z',
          planEndDate: '2026-09-09T00:00:00.000Z',
        },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).rejects.toThrow(/planEndDate must be on or after planStartDate/);
  });

  it('accepts planEndDate === planStartDate (same-day is valid)', async () => {
    await expect(
      adminRiderUseCases.update(
        'r1',
        {
          planStartDate: '2026-09-10T00:00:00.000Z',
          planEndDate: '2026-09-10T00:00:00.000Z',
        },
        { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
      )
    ).resolves.toBeDefined();
  });
});

describe('NET-005 follow-up-24: phone-lookup-cache invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupHappyPath();
  });

  it('invalidates BOTH old and new phone keys when the phone changes', async () => {
    // The pre-fix code never invalidated the phone
    // cache on update — a phone change from
    // 9999999999 → 8888888888 left both cached
    // entries stale (the old phone still cached
    // as "rider exists"; the new phone still
    // cached as "rider does not exist" until the
    // TTL).
    await adminRiderUseCases.update(
      'r1',
      { phone: '8888888888' },
      { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
    );
    expect(mocks.invalidateRiderPhoneCache).toHaveBeenCalledWith('9999999999');
    expect(mocks.invalidateRiderPhoneCache).toHaveBeenCalledWith('8888888888');
  });

  it('does NOT invalidate the phone cache when the phone is unchanged', async () => {
    await adminRiderUseCases.update(
      'r1',
      { fullName: 'New Name' },
      { actorId: 'admin-1', actorRole: 'OPERATIONS_ADMIN' }
    );
    // No phone in the write — no phone cache
    // invalidation. (The rider cache IS
    // invalidated — that's a separate call.)
    expect(mocks.invalidateRiderPhoneCache).not.toHaveBeenCalled();
  });
});
