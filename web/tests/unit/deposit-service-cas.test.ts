/**
 * DEPOSIT-FINANCE-P1-2026-09-07 (P1-3): CAS on the linked
 * Transaction update in `approveDeposit` and `rejectDeposit`. A
 * REJECTED transaction could be silently re-approved through the
 * deposits route, because the transactions-API REJECT path didn't
 * touch the DepositRecord. `updateMany` with `status: 'PENDING'`
 * returns count=0 if the linked transaction is already touched; the
 * function throws to roll the $transaction back.
 *
 * Pure-logic test with `db.$transaction` mocked as a passthrough
 * that runs the inner callback. The Prisma `updateMany` is mocked
 * per-test to return the desired count.
 */

import { describe, it, expect, vi } from 'vitest';
import { db } from '@/lib/db';

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/fcm', () => ({
  fcmService: { sendOverlayTrigger: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

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

import { approveDeposit, rejectDeposit, DepositStateError } from '@/lib/services/deposit-service';

interface MockTx {
  depositRecord: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
  };
  rider: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  transaction: {
    updateMany: ReturnType<typeof vi.fn>;
  };
}

function makeTx(opts: {
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'FORFEITED';
  linkedTransactionId?: string;
  transactionUpdateCount: number;
  riderLifecycleStatus?: string;
}): MockTx {
  return {
    depositRecord: {
      findUnique: vi.fn().mockResolvedValue({
        riderId: 'rider-1',
        status: opts.status,
        amountInPaise: 50_000,
        transactionId: opts.linkedTransactionId ?? null,
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    wallet: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'wallet-1',
        balanceInPaise: 0,
        securityDepositInPaise: 50_000,
      }),
    },
    rider: {
      findUnique: vi.fn().mockResolvedValue({
        lifecycleStatus: opts.riderLifecycleStatus ?? 'PLAN_SELECTED',
      }),
      update: vi.fn().mockResolvedValue({}),
    },
    transaction: {
      updateMany: vi.fn().mockResolvedValue({ count: opts.transactionUpdateCount }),
    },
  };
}

function wireDbTransaction(tx: MockTx) {
  // The static `import { db } from '@/lib/db'` is mocked via vi.mock
  // (or a global setup). We mutate its $transaction directly.
  db.$transaction = (fn: any) => fn(tx);
}

describe('approveDeposit — linked-transaction CAS (P1-3)', () => {
  it('succeeds when linked transaction is PENDING (count=1)', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: 'txn-1',
      transactionUpdateCount: 1,
    });
    wireDbTransaction(tx);

    await expect(
      approveDeposit({ riderId: 'rider-1', adminId: 'admin-1' }),
    ).resolves.toBeUndefined();
    expect(tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'txn-1', status: 'PENDING' }),
        data: expect.objectContaining({ status: 'APPROVED', purpose: 'SECURITY_DEPOSIT' }),
      }),
    );
  });

  it('throws when linked transaction is already REJECTED (count=0)', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: 'txn-1',
      transactionUpdateCount: 0, // CAS misses → already REJECTED
    });
    wireDbTransaction(tx);

    await expect(
      approveDeposit({ riderId: 'rider-1', adminId: 'admin-1' }),
    ).rejects.toBeInstanceOf(DepositStateError);
    await expect(
      approveDeposit({ riderId: 'rider-1', adminId: 'admin-1' }),
    ).rejects.toThrow(/is not PENDING/);
  });

  it('throws when linked transaction is already APPROVED (count=0)', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: 'txn-1',
      transactionUpdateCount: 0,
    });
    wireDbTransaction(tx);

    await expect(
      approveDeposit({ riderId: 'rider-1', adminId: 'admin-1' }),
    ).rejects.toThrow(DepositStateError);
  });

  it('no linked transaction → no CAS call, succeeds', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: undefined,
      transactionUpdateCount: 0,
    });
    wireDbTransaction(tx);

    await expect(
      approveDeposit({ riderId: 'rider-1', adminId: 'admin-1' }),
    ).resolves.toBeUndefined();
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });
});

describe('rejectDeposit — linked-transaction CAS (P1-3)', () => {
  it('succeeds when linked transaction is PENDING (count=1)', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: 'txn-1',
      transactionUpdateCount: 1,
    });
    wireDbTransaction(tx);

    await expect(
      rejectDeposit({ riderId: 'rider-1', adminId: 'admin-1', reason: 'fake proof' }),
    ).resolves.toBeUndefined();
    expect(tx.transaction.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'txn-1', status: 'PENDING' }),
        data: expect.objectContaining({ status: 'REJECTED', rejectionReason: 'fake proof' }),
      }),
    );
  });

  it('throws when linked transaction is already APPROVED (count=0)', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: 'txn-1',
      transactionUpdateCount: 0,
    });
    wireDbTransaction(tx);

    await expect(
      rejectDeposit({ riderId: 'rider-1', adminId: 'admin-1', reason: 'fake proof' }),
    ).rejects.toBeInstanceOf(DepositStateError);
    await expect(
      rejectDeposit({ riderId: 'rider-1', adminId: 'admin-1', reason: 'fake proof' }),
    ).rejects.toThrow(/is not PENDING/);
  });

  it('throws when linked transaction is already REJECTED (count=0)', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: 'txn-1',
      transactionUpdateCount: 0,
    });
    wireDbTransaction(tx);

    await expect(
      rejectDeposit({ riderId: 'rider-1', adminId: 'admin-1', reason: 'fake proof' }),
    ).rejects.toThrow(DepositStateError);
  });

  it('no linked transaction → no CAS call, succeeds', async () => {
    const tx = makeTx({
      status: 'PENDING',
      linkedTransactionId: undefined,
      transactionUpdateCount: 0,
    });
    wireDbTransaction(tx);

    await expect(
      rejectDeposit({ riderId: 'rider-1', adminId: 'admin-1', reason: 'fake proof' }),
    ).resolves.toBeUndefined();
    expect(tx.transaction.updateMany).not.toHaveBeenCalled();
  });
});
