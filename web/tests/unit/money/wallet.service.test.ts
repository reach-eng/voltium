import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { walletService } from '../../../src/server/modules/wallet/wallet.service';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';
import {
  LedgerCategory,
  TransactionStatus,
  TransactionType,
  TransactionPurpose,
  TransactionAudience,
} from '@prisma/client';

describe('walletService (Money Paths - Real DB)', () => {
  let riderId: string;
  let riderDbId: string;
  let walletId: string;

  beforeEach(async () => {
    riderId = `RD-${uuidv4().replace(/-/g, '')}`;
    riderDbId = uuidv4();
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().replace(/-/g, '')}`;

    await testDb.rider.create({
      data: {
        id: riderDbId,
        riderId: riderId,
        phone: phone,
        fullName: 'Test Rider',
        referralCode: referralCode,
      },
    });

    const wallet = await testDb.wallet.create({
      data: {
        riderId: riderDbId,
        balanceInPaise: 0,
        securityDepositInPaise: 0,
        depositStatus: 'PENDING',
      },
    });
    walletId = wallet.id;
  });

  describe('creditBalance', () => {
    it('should credit balance with TOPUP_APPROVED and return new balance', async () => {
      const txn = await testDb.transaction.create({
        data: {
          riderId: riderDbId,
          amountInPaise: 5000,
          type: TransactionType.CREDIT,
          purpose: TransactionPurpose.TOP_UP,
          audience: TransactionAudience.USER,
          status: TransactionStatus.APPROVED,
        },
      });

      const newBal = await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED', {
        note: 'Initial top-up',
        txnId: txn.id,
      });

      expect(newBal).toBe(5000);

      const bal = await walletService.getBalance(riderDbId);
      expect(bal).toBe(5000);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe(LedgerCategory.TOP_UP);
      expect(entries[0].amountInPaise).toBe(5000);
      expect(entries[0].note).toBe('Initial top-up');
      expect(entries[0].transactionId).toBe(txn.id);
    });

    it('should credit balance with REWARD_CREDIT', async () => {
      const newBal = await walletService.creditBalance(riderDbId, 1500, 'REWARD_CREDIT', {
        note: 'Referral bonus',
      });

      expect(newBal).toBe(1500);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries[0].category).toBe(LedgerCategory.REWARD);
      expect(entries[0].amountInPaise).toBe(1500);
    });

    it('should credit balance with DEPOSIT_CREDIT', async () => {
      const newBal = await walletService.creditBalance(riderDbId, 20000, 'DEPOSIT_CREDIT');
      expect(newBal).toBe(20000);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries[0].category).toBe(LedgerCategory.SECURITY_DEPOSIT);
    });

    it('should credit balance with ADMIN_ADJUSTMENT and actorId', async () => {
      const adminId = uuidv4();
      const newBal = await walletService.creditBalance(riderDbId, 1000, 'ADMIN_ADJUSTMENT', {
        actorId: adminId,
        note: 'Goodwill gesture',
      });

      expect(newBal).toBe(1000);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries[0].category).toBe(LedgerCategory.ADMIN_ADJUSTMENT);
      expect(entries[0].actorId).toBe(adminId);
    });

    it('should handle idempotency keys on credit', async () => {
      const idemKey = `idem-${uuidv4()}`;
      const first = await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED', {
        idempotencyKey: idemKey,
      });
      expect(first).toBe(5000);

      // Second attempt with same idempotency key returns existing balance without double-crediting
      const second = await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED', {
        idempotencyKey: idemKey,
      });
      expect(second).toBe(5000);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries).toHaveLength(1);
    });
  });

  describe('debitBalance', () => {
    beforeEach(async () => {
      await walletService.creditBalance(riderDbId, 10000, 'TOPUP_APPROVED');
    });

    it('should debit balance with RENT_DEBIT', async () => {
      const newBal = await walletService.debitBalance(riderDbId, 3000, 'RENT_DEBIT', {
        note: 'Daily rental deduction',
      });

      expect(newBal).toBe(7000);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries).toHaveLength(2);
      expect(entries[0].category).toBe(LedgerCategory.RENT_PAYMENT);
      expect(entries[0].amountInPaise).toBe(3000);
      expect(entries[0].entryType).toBe('DEBIT');
    });

    it('should debit balance with FINE_DEBIT', async () => {
      const newBal = await walletService.debitBalance(riderDbId, 500, 'FINE_DEBIT', {
        note: 'Late return fine',
      });

      expect(newBal).toBe(9500);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries[0].category).toBe(LedgerCategory.RENT_PAYMENT);
      expect(entries[0].amountInPaise).toBe(500);
    });

    it('should debit balance with REVERSAL', async () => {
      const newBal = await walletService.debitBalance(riderDbId, 2000, 'REVERSAL', {
        note: 'Payment chargeback reversal',
      });

      expect(newBal).toBe(8000);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries[0].category).toBe(LedgerCategory.REVERSAL);
    });

    it('should debit balance with DEPOSIT_REFUND', async () => {
      const newBal = await walletService.debitBalance(riderDbId, 10000, 'DEPOSIT_REFUND');
      expect(newBal).toBe(0);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries[0].category).toBe(LedgerCategory.REFUND);
    });

    it('should reject debit exceeding balance when allowNegative is not set', async () => {
      await expect(
        walletService.debitBalance(riderDbId, 15000, 'RENT_DEBIT')
      ).rejects.toThrow();

      const bal = await walletService.getBalance(riderDbId);
      expect(bal).toBe(10000);
    });

    it('should allow debit exceeding balance when allowNegative is true', async () => {
      const newBal = await walletService.debitBalance(riderDbId, 15000, 'RENT_DEBIT', {
        allowNegative: true,
      });

      expect(newBal).toBe(-5000);

      const bal = await walletService.getBalance(riderDbId);
      expect(bal).toBe(-5000);
    });

    it('should handle idempotency keys on debit', async () => {
      const idemKey = `idem-${uuidv4()}`;
      const first = await walletService.debitBalance(riderDbId, 2000, 'RENT_DEBIT', {
        idempotencyKey: idemKey,
      });
      expect(first).toBe(8000);

      const second = await walletService.debitBalance(riderDbId, 2000, 'RENT_DEBIT', {
        idempotencyKey: idemKey,
      });
      expect(second).toBe(8000);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      // 1 credit + 1 debit = 2 entries
      expect(entries).toHaveLength(2);
    });
  });

  describe('getBalance', () => {
    it('should return initial zero balance for newly created wallet', async () => {
      const bal = await walletService.getBalance(riderDbId);
      expect(bal).toBe(0);
    });

    it('should reflect balance changes accurately', async () => {
      await walletService.creditBalance(riderDbId, 7500, 'TOPUP_APPROVED');
      let bal = await walletService.getBalance(riderDbId);
      expect(bal).toBe(7500);

      await walletService.debitBalance(riderDbId, 2500, 'RENT_DEBIT');
      bal = await walletService.getBalance(riderDbId);
      expect(bal).toBe(5000);
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify integrity when ledger matches wallet balance', async () => {
      await walletService.creditBalance(riderDbId, 10000, 'TOPUP_APPROVED');
      await walletService.debitBalance(riderDbId, 4000, 'RENT_DEBIT');

      const integrity = await walletService.verifyIntegrity(riderDbId);
      expect(integrity.ok).toBe(true);
      expect(integrity.ledgerSum).toBe(6000);
      expect(integrity.walletBalance).toBe(6000);
      expect(integrity.drift).toBe(0);
    });

    it('should detect integrity mismatch if wallet balance is manipulated directly', async () => {
      await walletService.creditBalance(riderDbId, 10000, 'TOPUP_APPROVED');

      // Tamper directly with wallet row outside of ledger
      await testDb.wallet.update({
        where: { riderId: riderDbId },
        data: { balanceInPaise: 99999 },
      });

      const integrity = await walletService.verifyIntegrity(riderDbId);
      expect(integrity.ok).toBe(false);
      expect(integrity.ledgerSum).toBe(10000);
      expect(integrity.walletBalance).toBe(99999);
      expect(integrity.drift).toBe(89999);
    });
  });

  describe('backfillOpeningBalance', () => {
    it('should backfill opening balance when wallet has existing balance but no ledger entries', async () => {
      // Set existing balance without ledger entry
      await testDb.wallet.update({
        where: { riderId: riderDbId },
        data: { balanceInPaise: 8000 },
      });

      await walletService.backfillOpeningBalance(riderDbId);

      // Now verify integrity passes
      const integrity = await walletService.verifyIntegrity(riderDbId);
      expect(integrity.ok).toBe(true);
      expect(integrity.ledgerSum).toBe(8000);
      expect(integrity.drift).toBe(0);
    });

    it('should be idempotent and not create duplicate backfill entries', async () => {
      await testDb.wallet.update({
        where: { riderId: riderDbId },
        data: { balanceInPaise: 5000 },
      });

      await walletService.backfillOpeningBalance(riderDbId);
      await walletService.backfillOpeningBalance(riderDbId);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries).toHaveLength(1);
      expect(entries[0].category).toBe(LedgerCategory.ADMIN_ADJUSTMENT);
      expect(entries[0].note).toBe('Opening balance backfill — pre-ledger wallet balance');
    });

    it('should not backfill when wallet balance is 0', async () => {
      await walletService.backfillOpeningBalance(riderDbId);

      const entries = await walletRepository.getLedgerEntries(riderDbId);
      expect(entries).toHaveLength(0);
    });
  });
});
