import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  upsert: vi.fn(),
  create: vi.fn(),
  findMany: vi.fn(),
  transaction: vi.fn(),
  getCachedRider: vi.fn((id, fn) => fn()),
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUnique,
      update: mocks.update,
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
