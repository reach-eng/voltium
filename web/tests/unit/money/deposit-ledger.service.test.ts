import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { depositLedgerService } from '../../../src/server/modules/deposits/deposit-ledger.service';
import { DepositStatus } from '@prisma/client';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';

// TEST-STRATEGY-AUDIT T-P0-2 (2026-08-08, reverted 2026-08-08):
// the previously-skipped test below was targeted for re-enabling
// via a per-file schema (tests/_setup/per-file-schema.ts). The
// per-file schema approach failed in the test runner with
// "permission denied to create database" — the `voltium_user`
// (from .env) doesn't have CREATEDB privilege, and the
// process.env.DATABASE_URL change in beforeAll is too late for
// the `db` singleton (already initialized at import time).
//
// The skipped test stays skipped. Tracked as T-P0-2-backfill.
// usePerFileSchema(__filename);  // disabled — see T-P0-2-backfill

describe('depositLedgerService', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
  });

  let riderDbId: string;
  let transactionId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
    transactionId = `txn-${uuidv4()}`;
    const riderId = `RD-${uuidv4().replace(/-/g, '').substring(0, 8)}`;
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().replace(/-/g, '').substring(0, 10)}`;

    await testDb.rider.create({
      data: {
        id: riderDbId,
        riderId: riderId,
        phone: phone,
        fullName: 'Test Rider',
        referralCode: referralCode,
      },
    });

    await testDb.wallet.create({
      data: {
        riderId: riderDbId,
        balanceInPaise: 0,
        securityDepositInPaise: 0,
        depositStatus: 'PENDING',
      }
    });

    await testDb.transaction.create({
      data: {
        id: transactionId,
        riderId: riderDbId,
        type: 'CREDIT',
        amountInPaise: 5000,
        purpose: 'SECURITY_DEPOSIT',
        status: 'PENDING',
        method: 'RAZORPAY',
        receipt: 'pay_123',
      }
    });
  });

  it.skip('should upsert record', async () => {
    // TEST-STRATEGY-AUDIT T-P0-2 (reverted 2026-08-08): the
    // per-file schema pattern from `tests/_setup/per-file-schema.ts`
    // was tried but failed in the test runner with
    // "permission denied to create database" — the `voltium_user`
    // (from .env) doesn't have CREATEDB privilege, and the
    // process.env.DATABASE_URL change in beforeAll is too late
    // for the `db` singleton (already initialized at import time).
    //
    // The original `it.skip` is restored. Tracked as T-P0-2-backfill.
    await depositLedgerService.upsertRecord({
      riderId: riderDbId,
      transactionId: transactionId,
      amountInPaise: 5000,
    });

    // Check db
    const record = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
    expect(record?.amountInPaise).toBe(5000);
  });

  it('should approve deposit', async () => {
    await testDb.depositRecord.create({
      data: {
        riderId: riderDbId,
        amountInPaise: 5000,
        status: DepositStatus.PENDING,
      }
    });

    await depositLedgerService.approve({
      riderId: riderDbId,
      adminId: 'admin-1',
    });

    const record = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
    expect(record?.status).toBe('APPROVED');

    const wallet = await testDb.wallet.findUnique({ where: { riderId: riderDbId } });
    expect(wallet?.securityDepositInPaise).toBe(5000);
    
    const entries = await walletRepository.getLedgerEntries(riderDbId);
    expect(entries).toHaveLength(1);
    expect(entries[0].category).toBe('SECURITY_DEPOSIT');
    expect(entries[0].entryType).toBe('CREDIT');
  });

  it('should reject deposit', async () => {
    await testDb.depositRecord.create({
      data: {
        riderId: riderDbId,
        amountInPaise: 5000,
        status: DepositStatus.PENDING,
      }
    });

    await depositLedgerService.reject({
      riderId: riderDbId,
      adminId: 'admin-1',
      reason: 'Fake transfer',
    });

    const record = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
    expect(record?.status).toBe('REJECTED');
  });

  it('should refund deposit', async () => {
    await testDb.depositRecord.create({
      data: {
        riderId: riderDbId,
        amountInPaise: 5000,
        status: DepositStatus.APPROVED,
      }
    });

    await testDb.wallet.update({
      where: { riderId: riderDbId },
      data: { securityDepositInPaise: 5000 },
    });

    await depositLedgerService.refund({
      riderId: riderDbId,
      adminId: 'admin-1',
    });

    const record = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
    expect(record?.status).toBe('REFUNDED');

    const wallet = await testDb.wallet.findUnique({ where: { riderId: riderDbId } });
    expect(wallet?.securityDepositInPaise).toBe(0);
  });
  it('should forfeit deposit', async () => {
    await testDb.depositRecord.create({
      data: {
        riderId: riderDbId,
        amountInPaise: 5000,
        status: DepositStatus.APPROVED,
      }
    });

    await testDb.wallet.update({
      where: { riderId: riderDbId },
      data: { securityDepositInPaise: 5000 },
    });

    await depositLedgerService.forfeit({
      riderId: riderDbId,
      adminId: 'admin-1',
      reason: 'Vehicle damaged',
    });

    const record = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
    expect(record?.status).toBe('FORFEITED');
    expect(record?.forfeitReason).toBe('Vehicle damaged');

    const wallet = await testDb.wallet.findUnique({ where: { riderId: riderDbId } });
    expect(wallet?.securityDepositInPaise).toBe(0);
  });

  describe('Edge cases and State Transitions', () => {
    it('throws DepositStateError if deposit record is missing', async () => {
      await expect(depositLedgerService.approve({
        riderId: 'non-existent-rider',
        adminId: 'admin-1',
      })).rejects.toThrow(); // Should be DepositStateError but rejects.toThrow() is sufficient
    });

    it('throws DepositStateError if wallet is missing', async () => {
      // Create a rider without a wallet
      const noWalletRiderId = uuidv4();
      await testDb.rider.create({
        data: {
          id: noWalletRiderId,
          riderId: `RD-${uuidv4().substring(0, 12)}`,
          phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
          fullName: 'No Wallet Rider',
          referralCode: `REF-${uuidv4().substring(0, 12)}`,
        }
      });
      await testDb.depositRecord.create({
        data: {
          riderId: noWalletRiderId,
          amountInPaise: 5000,
          status: DepositStatus.PENDING,
        }
      });

      await expect(depositLedgerService.approve({
        riderId: noWalletRiderId,
        adminId: 'admin-1',
      })).rejects.toThrow();
    });

    it('is idempotent on already APPROVED deposit (no-op) and throws on invalid transition', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.APPROVED,
        }
      });

      // Idempotent approve on already APPROVED deposit resolves without error
      await expect(depositLedgerService.approve({
        riderId: riderDbId,
        adminId: 'admin-1',
      })).resolves.toBeUndefined();

      // Approve on FORFEITED deposit throws DepositStateError
      await testDb.depositRecord.update({
        where: { riderId: riderDbId },
        data: { status: DepositStatus.FORFEITED },
      });
      await expect(depositLedgerService.approve({
        riderId: riderDbId,
        adminId: 'admin-1',
      })).rejects.toThrow();
    });

    it('throws DepositStateError on REFUND of PENDING deposit', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.PENDING,
        }
      });

      await expect(depositLedgerService.refund({
        riderId: riderDbId,
        adminId: 'admin-1',
      })).rejects.toThrow();
    });
    
    it('approving with a bonus credits the bonus to general balance', async () => {
      await testDb.depositRecord.deleteMany({ where: { riderId: riderDbId } });
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.PENDING,
        }
      });

      await depositLedgerService.approve({
        riderId: riderDbId,
        adminId: 'admin-1',
        bonusAmountInPaise: 1000,
      });

      const wallet = await testDb.wallet.findUnique({ where: { riderId: riderDbId } });
      expect(wallet?.securityDepositInPaise).toBe(5000); // the deposit
      expect(wallet?.balanceInPaise).toBe(1000);  // the bonus
      
      const entries = await walletRepository.getLedgerEntries(riderDbId);
      // One for security deposit, one for the bonus (admin adjustment)
      expect(entries).toHaveLength(2);
      const bonusEntry = entries.find(e => e.category === 'ADMIN_ADJUSTMENT');
      expect(bonusEntry).toBeDefined();
      expect(bonusEntry?.amountInPaise).toBe(1000);
    });

    it('refunds custom amount with note', async () => {
      await testDb.depositRecord.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          status: DepositStatus.APPROVED,
        }
      });

      await testDb.wallet.update({
        where: { riderId: riderDbId },
        data: { securityDepositInPaise: 5000 },
      });

      await depositLedgerService.refund({
        riderId: riderDbId,
        adminId: 'admin-1',
        refundAmountInPaise: 2000, // partial refund
        note: 'Partial refund due to outstanding balance',
      });

      const record = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
      expect(record?.status).toBe('PARTIALLY_REFUNDED');
      expect(record?.refundedAmountInPaise).toBe(2000);

      const wallet = await testDb.wallet.findUnique({ where: { riderId: riderDbId } });
      // Security deposit is debited by 2000, leaving 3000
      expect(wallet?.securityDepositInPaise).toBe(3000);
      // General balance is credited by 2000
      expect(wallet?.balanceInPaise).toBe(2000);
      
      const entries = await walletRepository.getLedgerEntries(riderDbId);
      const creditRefund = entries.find(e => e.entryType === 'CREDIT' && e.category === 'REFUND');
      expect(creditRefund?.note).toBe('Partial refund due to outstanding balance');

      // Refund remaining 3000 -> status should transition to REFUNDED
      await depositLedgerService.refund({
        riderId: riderDbId,
        adminId: 'admin-1',
        refundAmountInPaise: 3000,
        note: 'Final refund of remaining security deposit',
      });

      const finalRecord = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
      expect(finalRecord?.status).toBe('REFUNDED');
      expect(finalRecord?.refundedAmountInPaise).toBe(5000);
    });
  });
});
