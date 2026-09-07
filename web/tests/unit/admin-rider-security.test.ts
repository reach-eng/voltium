import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';
import { updateRiderSchema } from '@/app/api/admin/riders/route';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  guarantorFindUnique: vi.fn(),
  getCachedRider: vi.fn((id, fn) => fn()),
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
  invalidateRiderCache: vi.fn(),
}));

describe('Admin Rider Security - Wallet mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects direct walletBalance updates via admin update', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'r1', riderId: 'VF-RD-123', serialNumber: 1 });
    
    await expect(
      adminRiderUseCases.update('r1', { walletBalance: 500 }, { actorId: 'a1', actorRole: 'ADMIN' })
    ).rejects.toThrow('Direct walletBalance mutations are blocked — use Wallet Adjust API');
  });

  it('allows safe rider field updates', async () => {
    mocks.findUnique.mockResolvedValue({ id: 'r1', riderId: 'VF-RD-123', serialNumber: 1 });
    mocks.transaction.mockResolvedValue({ id: 'r1', fullName: 'Test' });

    const result = await adminRiderUseCases.update('r1', { fullName: 'Test Rider' }, { actorId: 'a1', actorRole: 'ADMIN' });
    expect(mocks.transaction).toHaveBeenCalled();
  });

  // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): the bulk
  // Suspend action goes through the use-case with
  // `{lifecycleStatus: 'SUSPENDED'}`. Before the fix
  // `lifecycleStatus` was absent from `SAFE_RIDER_FIELDS`
  // and silently dropped; the audit found the bulk
  // toolbar reporting "1 updated" while changing
  // nothing. Verify the field now reaches the
  // transaction body.
  it('allows lifecycleStatus as a SAFE_RIDER_FIELDS entry', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-123',
      serialNumber: 1,
      lifecycleStatus: 'ACTIVE',
    });
    // The use-case reads `db.guarantor.findUnique` at line
    // 485 (outside the transaction) when handling KYC
    // transitions. No KYC change here, but the call still
    // runs. Stub it.
    mocks.guarantorFindUnique.mockResolvedValue(null);
    // The transaction body touches tx.rider.update,
    // tx.kycProfile.findUnique, tx.wallet.findUnique,
    // tx.guarantor.upsert, and tx.rider.findUnique. Mock
    // all of them with no-op shapes so the body runs to
    // completion, and capture the rider.update payload.
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'PENDING' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      wallet: { findUnique: vi.fn().mockResolvedValue(null) },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      { lifecycleStatus: 'SUSPENDED' },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    expect(tx.rider.update).toHaveBeenCalled();
    const updateCall = tx.rider.update.mock.calls[0][0];
    expect(updateCall.data).toMatchObject({ lifecycleStatus: 'SUSPENDED' });
  });

  // ADMIN-RIDER-AUDIT P0-1 (2026-09-08): `accountStatus`
  // is a virtual field — it does not exist on the rider
  // model. Even though the audit's prior code sent
  // `{accountStatus: value}` to the use-case, the
  // allowlist must keep it OUT of the rider update.
  it('drops virtual accountStatus (mass-assignment safety)', async () => {
    mocks.findUnique.mockResolvedValue({
      id: 'r1',
      riderId: 'VF-RD-123',
      serialNumber: 1,
      lifecycleStatus: 'ACTIVE',
    });
    mocks.guarantorFindUnique.mockResolvedValue(null);
    const tx = {
      rider: {
        update: vi.fn().mockResolvedValue({}),
        findUnique: vi.fn().mockResolvedValue({
          id: 'r1',
          kycProfile: { status: 'PENDING' },
          wallet: { id: 'w1', balanceInPaise: 0 },
          guarantor: null,
        }),
      },
      kycProfile: { findUnique: vi.fn().mockResolvedValue(null) },
      wallet: { findUnique: vi.fn().mockResolvedValue(null) },
      guarantor: { upsert: vi.fn().mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (fn) => fn(tx));

    await adminRiderUseCases.update(
      'r1',
      // The legacy / pre-fix payload that the bulk route
      // used to send. The use-case must not surface
      // `accountStatus` to the rider update.
      { accountStatus: 'APPROVED', lifecycleStatus: 'SUSPENDED' },
      { actorId: 'a1', actorRole: 'ADMIN' }
    );

    expect(tx.rider.update).toHaveBeenCalled();
    const updateCall = tx.rider.update.mock.calls[0][0];
    expect(updateCall.data).not.toHaveProperty('accountStatus');
    expect(updateCall.data).toMatchObject({ lifecycleStatus: 'SUSPENDED' });
  });
});

describe('updateRiderSchema wire shape (P0-2 cluster)', () => {
  // ADMIN-RIDER-AUDIT P0-2 (2026-09-08): the route schema
  // is the second gate after the use-case allowlist. The
  // audit's P0-2 cluster found that the schema's
  // `z.string().max(100).optional()` (no nullable) silently
  // rejected every Clear-Guarantor and KYC-doc-delete PUT
  // — both of which send `null` to wipe the field. The
  // schema now accepts `null` and `''` on every nullable
  // text field. These tests assert the wire shape.

  it('P0-2a: accepts null on every guarantor text field (Clear Guarantor)', () => {
    const result = updateRiderSchema.safeParse({
      id: 'r1',
      guarantorName: null,
      guarantorRelation: null,
      guarantorPhone: null,
      guarantorDob: null,
      guarantorAadhaarFront: null,
      guarantorAadhaarBack: null,
      guarantorPan: null,
      guarantorVideo: null,
      guarantorSignature: null,
      guarantorFatherName: null,
      guarantorMotherName: null,
      guarantorAddress: null,
      guarantorPhoto: null,
    });
    expect(result.success).toBe(true);
  });

  it('P0-2a: also accepts empty string on guarantor fields', () => {
    const result = updateRiderSchema.safeParse({
      id: 'r1',
      guarantorName: '',
      guarantorPhone: '',
    });
    expect(result.success).toBe(true);
  });

  it('P0-2b: accepts null on every KYC doc URL field', () => {
    const result = updateRiderSchema.safeParse({
      id: 'r1',
      profilePhoto: null,
      riderPhoto: null,
      riderVideo: null,
      signature: null,
      aadhaarFront: null,
      aadhaarBack: null,
      panCard: null,
    });
    expect(result.success).toBe(true);
  });

  it('P0-2c: accepts lifecycleStatus as a writable enum', () => {
    const result = updateRiderSchema.safeParse({
      id: 'r1',
      lifecycleStatus: 'SUSPENDED',
    });
    expect(result.success).toBe(true);
  });

  it('P0-2c: also accepts null/empty for lifecycleStatus (clear)', () => {
    expect(updateRiderSchema.safeParse({ id: 'r1', lifecycleStatus: null }).success).toBe(true);
    expect(updateRiderSchema.safeParse({ id: 'r1', lifecycleStatus: '' }).success).toBe(true);
  });

  it('P0-2c: rejects invalid lifecycleStatus values', () => {
    const result = updateRiderSchema.safeParse({
      id: 'r1',
      lifecycleStatus: 'NOT_A_REAL_STATE',
    });
    expect(result.success).toBe(false);
  });

  it('P0-2e: accepts intent="" (null-intent riders)', () => {
    const result = updateRiderSchema.safeParse({ id: 'r1', intent: '' });
    expect(result.success).toBe(true);
  });

  it('P0-2e: accepts intent=null', () => {
    const result = updateRiderSchema.safeParse({ id: 'r1', intent: null });
    expect(result.success).toBe(true);
  });

  it('P0-2e: accepts dob in dd-MM-yyyy format', () => {
    const result = updateRiderSchema.safeParse({ id: 'r1', dob: '15-01-1990' });
    expect(result.success).toBe(true);
  });

  it('P0-2e: accepts dob in yyyy-MM-dd format (rider app sends this)', () => {
    const result = updateRiderSchema.safeParse({ id: 'r1', dob: '1990-01-15' });
    expect(result.success).toBe(true);
  });

  it('P0-2e: rejects dob in freeform strings', () => {
    const result = updateRiderSchema.safeParse({ id: 'r1', dob: '15 Jan 1990' });
    expect(result.success).toBe(false);
  });

  it('P0-2d: does NOT include depositStatus (use the Deposits API instead)', () => {
    // The route schema deliberately omits `depositStatus` so
    // the MoneyTab's editable select — which the audit found
    // to write depositStatus into the form — fails the
    // schema parse (or, in the post-P0-1 strict-strip mode,
    // silently drops). Either way, the use-case never sees
    // a direct depositStatus write and the "Use the Deposits
    // API" throw at use-case:612 stays the only enforcement.
    const result = updateRiderSchema.safeParse({ id: 'r1', depositStatus: 'PAID' });
    // The schema is not in .strict() mode, so unknown keys
    // are stripped. The parse succeeds with `id` only.
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('depositStatus');
    }
  });
});
