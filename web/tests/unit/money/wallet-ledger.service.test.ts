import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { walletLedgerService, WalletServiceError } from '../../../src/server/modules/wallet/wallet-ledger.service';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';
import { LedgerCategory } from '@prisma/client';

describe('walletLedgerService', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

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
      }
    });
    walletId = wallet.id;
  });

  it('should credit wallet', async () => {
    const result = await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 5000,
      category: LedgerCategory.TOP_UP,
      note: 'test credit',
    });

    expect(result.newBalance).toBe(5000);

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    expect(entries).toHaveLength(1);
    expect(entries[0].amountInPaise).toBe(5000);
    expect(entries[0].category).toBe(LedgerCategory.TOP_UP);
    expect(entries[0].entryType).toBe('CREDIT');
  });

  it('should debit wallet', async () => {
    await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 10000,
      category: LedgerCategory.TOP_UP,
    });

    const result = await walletLedgerService.debit({
      riderId: riderDbId,
      amountInPaise: 3000,
      category: LedgerCategory.RENT_PAYMENT,
    });

    expect(result.newBalance).toBe(7000);

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    expect(entries).toHaveLength(2);
    // The entries are ordered desc by createdAt, so the debit is first
    expect(entries[0].amountInPaise).toBe(3000);
    expect(entries[0].category).toBe(LedgerCategory.RENT_PAYMENT);
    expect(entries[0].entryType).toBe('DEBIT');
  });

  it('should not allow debit below zero', async () => {
    await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 1000,
      category: LedgerCategory.TOP_UP,
    });

    await expect(walletLedgerService.debit({
      riderId: riderDbId,
      amountInPaise: 3000,
      category: LedgerCategory.RENT_PAYMENT,
    })).rejects.toThrow();
  });

  it('should allow negative balance if flag is passed', async () => {
    await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 1000,
      category: LedgerCategory.TOP_UP,
    });

    const result = await walletLedgerService.debit({
      riderId: riderDbId,
      amountInPaise: 3000,
      category: LedgerCategory.RENT_PAYMENT,
      allowNegative: true,
    });

    expect(result.newBalance).toBe(-2000);
  });

  it('should credit security deposit', async () => {
    await walletLedgerService.creditSecurityDeposit({
      riderId: riderDbId,
      amountInPaise: 5000,
    });

    const wallet = await walletRepository.findByRiderId(riderDbId);
    expect(wallet?.securityDepositInPaise).toBe(5000);

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    expect(entries).toHaveLength(1);
    expect(entries[0].category).toBe(LedgerCategory.SECURITY_DEPOSIT);
    expect(entries[0].entryType).toBe('CREDIT');
  });

  it('should verify integrity successfully', async () => {
    await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 10000,
      category: LedgerCategory.TOP_UP,
    });

    await walletLedgerService.debit({
      riderId: riderDbId,
      amountInPaise: 2000,
      category: LedgerCategory.RENT_PAYMENT,
    });

    const integrity = await walletLedgerService.verifyIntegrity(riderDbId);
    expect(integrity.drift).toBe(0);
    expect(integrity.walletBalance).toBe(8000);
    expect(integrity.ledgerSum).toBe(8000);
  });

  it('should throw WalletServiceError when wallet not found for credit', async () => {
    await expect(walletLedgerService.credit({
      riderId: 'non-existent-rider',
      amountInPaise: 1000,
      category: LedgerCategory.TOP_UP,
    })).rejects.toThrow(WalletServiceError);
  });

  it('should throw WalletServiceError when wallet not found for debit', async () => {
    await expect(walletLedgerService.debit({
      riderId: 'non-existent-rider',
      amountInPaise: 1000,
      category: LedgerCategory.RENT_PAYMENT,
    })).rejects.toThrow(WalletServiceError);
  });

  it('should throw WalletServiceError when wallet not found for creditSecurityDeposit', async () => {
    await expect(walletLedgerService.creditSecurityDeposit({
      riderId: 'non-existent-rider',
      amountInPaise: 5000,
    })).rejects.toThrow(WalletServiceError);
  });

  it('credit passes actorId and note to ledger entry', async () => {
    const note = 'Manual top-up';

    await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 2000,
      category: LedgerCategory.TOP_UP,
      note,
    });

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    expect(entries[0].note).toBe(note);
    expect(entries[0].amountInPaise).toBe(2000);
  });

  it('debit passes note to ledger entry', async () => {
    await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 10000,
      category: LedgerCategory.TOP_UP,
    });

    const note = 'Monthly rent';

    await walletLedgerService.debit({
      riderId: riderDbId,
      amountInPaise: 3000,
      category: LedgerCategory.RENT_PAYMENT,
      note,
    });

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    const debitEntry = entries.find(e => e.entryType === 'DEBIT');
    expect(debitEntry?.note).toBe(note);
    expect(debitEntry?.amountInPaise).toBe(3000);
  });

  it('creditSecurityDeposit stores note and correct category', async () => {
    await walletLedgerService.creditSecurityDeposit({
      riderId: riderDbId,
      amountInPaise: 8000,
      note: 'Security deposit approved',
    });

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    expect(entries[0].amountInPaise).toBe(8000);
    expect(entries[0].category).toBe(LedgerCategory.SECURITY_DEPOSIT);
    expect(entries[0].note).toBe('Security deposit approved');
  });

  it('should reverse a credit entry', async () => {
    // Create a real Transaction row so we can use its id as txnId
    const txn = await testDb.transaction.create({
      data: {
        riderId: riderDbId,
        type: 'CREDIT',
        amountInPaise: 5000,
        purpose: 'TOP_UP',
        status: 'APPROVED',
      },
    });

    await walletLedgerService.credit({
      riderId: riderDbId,
      amountInPaise: 5000,
      category: LedgerCategory.TOP_UP,
      txnId: txn.id,
    });

    const resultAfterCredit = await walletRepository.getBalance(riderDbId);
    expect(resultAfterCredit).toBe(5000);

    // Reverse the credit
    await walletLedgerService.reverse({
      riderId: riderDbId,
      originalTxnId: txn.id,
      originalAmount: 5000,
      originalType: 'CREDIT',
      actorId: 'admin-rev',
      reason: 'Duplicate payment',
    });

    const balanceAfterReversal = await walletRepository.getBalance(riderDbId);
    expect(balanceAfterReversal).toBe(0);

    const entries = await walletRepository.getLedgerEntries(riderDbId);
    // Should have original credit + reversal entry
    expect(entries.length).toBe(2);
    const reversalEntry = entries.find(e => e.entryType === 'DEBIT');
    expect(reversalEntry).toBeDefined();
    expect(reversalEntry!.amountInPaise).toBe(5000);
  });

  it('should backfill opening balance without error', async () => {
    await expect(walletLedgerService.backfillOpeningBalance(riderDbId)).resolves.not.toThrow();
  });

  it('verifyIntegrity for non-existent wallet returns ok=false', async () => {
    const result = await walletLedgerService.verifyIntegrity('non-existent-rider');
    expect(result.ok).toBe(false);
    expect(result.walletBalance).toBe(0);
  });
});


