import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * PR-ONBOARDING-FLOW-2026-08-13: the wallet idempotency guard no
 * longer throws when the rider retries with a different amount in
 * the same 5-min window. The old behavior stranded the rider on
 * "A pending transaction with a different amount or purpose already
 * exists" — the rider's "Change amount" tap on the Enter Amount
 * screen looked like an error, not a feature.
 *
 * The new behavior:
 *   1. The stale PENDING transaction is marked CANCELLED (with an
 *      outbox event so the admin notification + audit log stay
 *      consistent).
 *   2. The new transaction is created with the new amount / purpose.
 *
 * The old row stays in the ledger for audit (never deleted) — the
 * wallet balance is unchanged because the stale row was PENDING and
 * never credited.
 */

const mocks = vi.hoisted(() => ({
  findTransactionByKey: vi.fn(),
  findUniqueRider: vi.fn(),
  updateTransaction: vi.fn(),
  createTransaction: vi.fn(),
  outboxEmit: vi.fn(),
  invalidateRiderCache: vi.fn(),
  auditLog: vi.fn(),
}));

vi.mock('@/server/modules/wallet/wallet.repository', () => ({
  walletRepository: {
    findTransactionByKey: mocks.findTransactionByKey,
    createTransaction: mocks.createTransaction,
  },
}));
vi.mock('@/lib/db', () => ({
  db: {
    rider: { findUnique: mocks.findUniqueRider },
    transaction: { update: mocks.updateTransaction },
    $transaction: vi.fn((fn) => fn({
      rider: { updateMany: vi.fn() },
      transaction: { update: mocks.updateTransaction },
    })),
  },
}));
vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: mocks.invalidateRiderCache,
}));
vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: mocks.outboxEmit },
  OutboxEventTypes: { NOTIFICATION_SEND: 'notification.send' },
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: mocks.auditLog }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/wallet-ledger.service', () => ({
  walletLedgerService: {
    credit: vi.fn(),
    creditSecurityDeposit: vi.fn(),
  },
}));

const { walletUseCases } = await import('@/server/modules/wallet/wallet.use-cases');

describe('Wallet Idempotency — cancel-and-replace on amount change (PR-ONBOARDING-FLOW-2026-08-13)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancels the stale PENDING and creates a new transaction when amount changes', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: 'r_1',
      phone: '+919876543210',
      lifecycleStatus: 'ACTIVE',
    });
    const existingTxn = {
      id: 'tx_old',
      status: 'PENDING',
      amountInPaise: 200000,
      purpose: 'TOP_UP',
      description: 'Wallet Top-up of ₹2000.00',
    };
    mocks.findTransactionByKey.mockResolvedValue(existingTxn);
    mocks.createTransaction.mockResolvedValue({
      id: 'tx_new',
      status: 'PENDING',
      amountInPaise: 250000,
      purpose: 'TOP_UP',
    });

    const result = await walletUseCases.requestTopup('r_1', 250000, 'TOP_UP', 'UPI', {
      idempotencyKey: 'key_1',
    });

    // The stale PENDING row is marked CANCELLED inside a transaction.
    expect(mocks.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx_old' },
        data: expect.objectContaining({
          status: 'CANCELLED',
        }),
      })
    );
    // The new transaction is created with the new amount.
    expect(mocks.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amountInPaise: 250000,
        purpose: 'TOP_UP',
      })
    );
    // The result is the new transaction, not the stale one.
    expect(result.id).toBe('tx_new');
  });

  it('emits an outbox event when cancelling the stale transaction (admin audit trail)', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: 'r_1',
      phone: '+919876543210',
      lifecycleStatus: 'ACTIVE',
    });
    mocks.findTransactionByKey.mockResolvedValue({
      id: 'tx_old',
      status: 'PENDING',
      amountInPaise: 200000,
      purpose: 'TOP_UP',
      description: 'Wallet Top-up of ₹2000.00',
    });
    mocks.createTransaction.mockResolvedValue({
      id: 'tx_new',
      status: 'PENDING',
      amountInPaise: 250000,
      purpose: 'TOP_UP',
    });

    await walletUseCases.requestTopup('r_1', 250000, 'TOP_UP', 'UPI', {
      idempotencyKey: 'key_1',
    });

    expect(mocks.outboxEmit).toHaveBeenCalledWith(
      'notification.send',
      expect.objectContaining({
        riderId: 'r_1',
        transactionId: 'tx_old',
        reason: 'superseded_by_new_amount',
        type: 'WALLET_TOPUP_REJECTED',
      }),
      expect.any(Number),
      expect.anything(),
      'interactive'
    );
  });

  it('returns the existing transaction on a true idempotent replay (same amount + same purpose)', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: 'r_1',
      phone: '+919876543210',
      lifecycleStatus: 'ACTIVE',
    });
    const existingTxn = {
      id: 'tx_same',
      status: 'PENDING',
      amountInPaise: 250000,
      purpose: 'TOP_UP',
      description: 'Wallet Top-up of ₹2500.00',
    };
    mocks.findTransactionByKey.mockResolvedValue(existingTxn);

    const result = await walletUseCases.requestTopup('r_1', 250000, 'TOP_UP', 'UPI', {
      idempotencyKey: 'key_1',
    });

    expect(result).toBe(existingTxn);
    expect(mocks.createTransaction).not.toHaveBeenCalled();
    expect(mocks.updateTransaction).not.toHaveBeenCalled();
  });

  it('throws when the existing transaction is already APPROVED/REJECTED (no double-charge)', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: 'r_1',
      phone: '+919876543210',
      lifecycleStatus: 'ACTIVE',
    });
    mocks.findTransactionByKey.mockResolvedValue({
      id: 'tx_finalized',
      status: 'APPROVED',
      amountInPaise: 250000,
      purpose: 'TOP_UP',
    });

    await expect(
      walletUseCases.requestTopup('r_1', 250000, 'TOP_UP', 'UPI', {
        idempotencyKey: 'key_1',
      })
    ).rejects.toThrow(/approved.*transaction.*already exists/i);
  });
});
