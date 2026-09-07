/**
 * DEPOSIT-FINANCE-P1-2026-09-07 (P1-2 part 1): funds pre-check for
 * `debitSecurityDeposit`. Mirrors the test style of wallet-service.test.ts:
 * pure-logic with `tx` mocked, no real DB.
 *
 * The funds guard prevents over-refund / over-forfeit. The previous
 * implementation blindly decremented `securityDepositInPaise` — a typo'd
 * ₹10L refund on a ₹500 deposit would drive the deposit field to
 * -₹9.95L and credit the wallet ₹10L of free money.
 */

import { describe, it, expect, vi } from 'vitest';

// Mocks must come before the import they affect.
vi.mock('@/lib/db', () => ({ db: {} }));

import { debitSecurityDeposit, WalletServiceError } from '@/lib/services/wallet-service';

interface MockTx {
  wallet: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  walletLedger: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
}

function makeTx(securityDepositInPaise: number, hasExistingLedger = false): MockTx {
  return {
    wallet: {
      findUnique: vi.fn().mockResolvedValue({ securityDepositInPaise }),
      update: vi.fn().mockResolvedValue({}),
    },
    walletLedger: {
      findUnique: vi.fn().mockResolvedValue(hasExistingLedger ? { id: 'ledger-1' } : null),
      create: vi.fn().mockResolvedValue({ id: 'ledger-new' }),
    },
  };
}

describe('debitSecurityDeposit — funds pre-check (P1-2)', () => {
  it('throws INSUFFICIENT_DEPOSIT when refund amount > held deposit', async () => {
    const tx = makeTx(50_000); // rider has ₹500 held
    await expect(
      debitSecurityDeposit(tx as any, {
        riderId: 'rider-1',
        walletId: 'wallet-1',
        amountInPaise: 10_000_000, // tries to refund ₹1L
        category: 'REFUND',
        newDepositStatus: 'REFUNDED',
        actorId: 'admin-1',
      }),
    ).rejects.toThrow(/Insufficient security deposit/);
  });

  it('rejects with code INSUFFICIENT_DEPOSIT on over-refund', async () => {
    const tx = makeTx(50_000);
    try {
      await debitSecurityDeposit(tx as any, {
        riderId: 'rider-1',
        walletId: 'wallet-1',
        amountInPaise: 50_001, // 1 paise over
        category: 'REFUND',
        newDepositStatus: 'REFUNDED',
        actorId: 'admin-1',
      });
      expect.fail('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(WalletServiceError);
      expect((err as WalletServiceError).code).toBe('INSUFFICIENT_DEPOSIT');
    }
  });

  it('succeeds when refund == held (boundary)', async () => {
    const tx = makeTx(50_000);
    await expect(
      debitSecurityDeposit(tx as any, {
        riderId: 'rider-1',
        walletId: 'wallet-1',
        amountInPaise: 50_000,
        category: 'REFUND',
        newDepositStatus: 'REFUNDED',
        actorId: 'admin-1',
      }),
    ).resolves.toBeUndefined();
    expect(tx.wallet.update).toHaveBeenCalledTimes(1);
    expect(tx.walletLedger.create).toHaveBeenCalledTimes(1);
  });

  it('succeeds when refund < held (partial, allowed)', async () => {
    const tx = makeTx(100_000); // rider has ₹1000
    await expect(
      debitSecurityDeposit(tx as any, {
        riderId: 'rider-1',
        walletId: 'wallet-1',
        amountInPaise: 25_000, // refund ₹250
        category: 'REFUND',
        newDepositStatus: 'REFUNDED',
        actorId: 'admin-1',
      }),
    ).resolves.toBeUndefined();
  });

  it('idempotency replay short-circuits before the funds check', async () => {
    const tx = makeTx(50_000, true /* existing ledger entry */);
    await expect(
      debitSecurityDeposit(tx as any, {
        riderId: 'rider-1',
        walletId: 'wallet-1',
        amountInPaise: 10_000_000, // would fail the funds check
        category: 'REFUND',
        newDepositStatus: 'REFUNDED',
        actorId: 'admin-1',
        idempotencyKey: 'replay-key',
      }),
    ).resolves.toBeUndefined();
    // The funds check never fires on replay; update/create are skipped.
    expect(tx.wallet.update).not.toHaveBeenCalled();
  });

  it('throws WalletServiceError when wallet does not exist', async () => {
    const tx: MockTx = {
      wallet: {
        findUnique: vi.fn().mockResolvedValue(null),
        update: vi.fn(),
      },
      walletLedger: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
    };
    await expect(
      debitSecurityDeposit(tx as any, {
        riderId: 'rider-1',
        walletId: 'wallet-missing',
        amountInPaise: 1000,
        category: 'REFUND',
        newDepositStatus: 'REFUNDED',
        actorId: 'admin-1',
      }),
    ).rejects.toThrow(/Wallet not found/);
  });
});
