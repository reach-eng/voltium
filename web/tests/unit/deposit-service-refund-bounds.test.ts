/**
 * DEPOSIT-FINANCE-P1-2026-09-07 (P1-2 part 2): refund-amount bounds
 * check in `deposit-service.refundDeposit`. The Zod schema caps
 * `refundAmount` at ₹10L but doesn't know what the rider actually
 * held. This test exercises the use-case-level guard.
 *
 * Pure-logic test with `db.$transaction` mocked as a passthrough that
 * runs the inner callback. No real DB.
 */

import { describe, it, expect, vi } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: (fn: any) => fn({}),
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: { sendOverlayTrigger: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Mock wallet-service so we don't need real Prisma for the ledger leg.
// The mock just records the call and returns successfully — the test
// only cares that refundDeposit's bounds check fires before this is reached.
vi.mock('@/lib/services/wallet-service', () => ({
  creditSecurityDeposit: vi.fn().mockResolvedValue(undefined),
  debitSecurityDeposit: vi.fn().mockResolvedValue(undefined),
  creditWallet: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/lifecycle-ranks', () => ({
  lifecycleRankOf: vi.fn().mockReturnValue(10),
}));

vi.mock('@/server/modules/riders/rider-lifecycle.service', () => ({
  transitionRiderStatus: vi.fn().mockResolvedValue(undefined),
}));

import { refundDeposit, DepositStateError } from '@/lib/services/deposit-service';

interface MockTx {
  depositRecord: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  transaction: {
    update: ReturnType<typeof vi.fn>;
  };
}

function makeTx(opts: {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'FORFEITED';
  heldAmountInPaise: number;
  transactionId?: string;
}): MockTx {
  return {
    depositRecord: {
      findUnique: vi.fn().mockResolvedValue({
        riderId: 'rider-1',
        status: opts.status,
        amountInPaise: opts.heldAmountInPaise,
        transactionId: opts.transactionId ?? null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    wallet: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'wallet-1',
        balanceInPaise: 0,
        securityDepositInPaise: opts.heldAmountInPaise,
      }),
    },
    transaction: {
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

function wireDbTransaction(tx: MockTx) {
  // The static `import { db } from '@/lib/db'` is mocked via vi.mock.
  // We mutate its $transaction directly to inject our mock tx.
  db.$transaction = (fn: any) => fn(tx);
}

describe('refundDeposit — refund-amount bounds (P1-2)', () => {
  it('throws DepositStateError when refundAmount > held deposit', async () => {
    const tx = makeTx({ status: 'APPROVED', heldAmountInPaise: 50_000 });
    wireDbTransaction(tx);

    await expect(
      refundDeposit({
        riderId: 'rider-1',
        adminId: 'admin-1',
        refundAmountInPaise: 10_000_000, // ₹1L on a ₹500 held
      }),
    ).rejects.toBeInstanceOf(DepositStateError);

    await expect(
      refundDeposit({
        riderId: 'rider-1',
        adminId: 'admin-1',
        refundAmountInPaise: 10_000_000,
      }),
    ).rejects.toThrow(/exceeds held deposit/);
  });

  it('succeeds when refundAmount == held deposit (boundary)', async () => {
    const tx = makeTx({ status: 'APPROVED', heldAmountInPaise: 50_000 });
    wireDbTransaction(tx);

    await expect(
      refundDeposit({
        riderId: 'rider-1',
        adminId: 'admin-1',
        refundAmountInPaise: 50_000,
      }),
    ).resolves.toBeUndefined();
    expect(tx.depositRecord.update).toHaveBeenCalledTimes(1);
  });

  it('succeeds when refundAmount < held deposit (partial refund allowed)', async () => {
    const tx = makeTx({ status: 'APPROVED', heldAmountInPaise: 100_000 });
    wireDbTransaction(tx);

    await expect(
      refundDeposit({
        riderId: 'rider-1',
        adminId: 'admin-1',
        refundAmountInPaise: 25_000, // partial: ₹250 of ₹1000
      }),
    ).resolves.toBeUndefined();
  });

  it('throws DepositStateError with 1-paise-over boundary', async () => {
    const tx = makeTx({ status: 'APPROVED', heldAmountInPaise: 50_000 });
    wireDbTransaction(tx);

    await expect(
      refundDeposit({
        riderId: 'rider-1',
        adminId: 'admin-1',
        refundAmountInPaise: 50_001,
      }),
    ).rejects.toBeInstanceOf(DepositStateError);
  });

  it('defaults to held deposit amount when refundAmount omitted (full refund)', async () => {
    const tx = makeTx({ status: 'APPROVED', heldAmountInPaise: 50_000 });
    wireDbTransaction(tx);

    await expect(
      refundDeposit({
        riderId: 'rider-1',
        adminId: 'admin-1',
        // refundAmountInPaise omitted → defaults to record.amountInPaise
      }),
    ).resolves.toBeUndefined();
  });
});
