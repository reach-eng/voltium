import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { walletService } from '../../../src/server/modules/wallet/wallet.service';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';
import fc from 'fast-check';

describe('walletService', () => {
  let riderId: string;
  let riderDbId: string;

  beforeEach(async () => {
    riderId = `RD-${uuidv4().substring(0, 6)}`;
    riderDbId = uuidv4();
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 6)}`;
    
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
        securityDeposit: 0,
        depositStatus: 'PENDING',
      }
    });
  });

  it('should credit balance', async () => {
    const newBalance = await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED', { note: 'test credit' });
    expect(newBalance).toBe(5000);
    
    const balance = await walletService.getBalance(riderDbId);
    expect(balance).toBe(5000);
    
    const ledger = await walletRepository.getLedgerEntries(riderDbId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].amountInPaise).toBe(5000);
    expect(ledger[0].entryType).toBe('CREDIT');
  });

  it('should debit balance', async () => {
    await walletService.creditBalance(riderDbId, 10000, 'TOPUP_APPROVED');
    
    const newBalance = await walletService.debitBalance(riderDbId, 3000, 'RENT_DEBIT');
    expect(newBalance).toBe(7000);
    
    const balance = await walletService.getBalance(riderDbId);
    expect(balance).toBe(7000);
  });

  it('should not allow debit below 0 unless allowNegative is true', async () => {
    await walletService.creditBalance(riderDbId, 1000, 'TOPUP_APPROVED');
    
    await expect(walletService.debitBalance(riderDbId, 3000, 'RENT_DEBIT')).rejects.toThrow();
    
    const newBalance = await walletService.debitBalance(riderDbId, 3000, 'RENT_DEBIT', { allowNegative: true });
    expect(newBalance).toBe(-2000);
  });

  it('should get balance', async () => {
    await walletService.creditBalance(riderDbId, 8000, 'TOPUP_APPROVED');
    
    const balance = await walletService.getBalance(riderDbId);
    expect(balance).toBe(8000);
  });

  it('accumulates multiple sequential credits correctly', async () => {
    await walletService.creditBalance(riderDbId, 1000, 'TOPUP_APPROVED');
    await walletService.creditBalance(riderDbId, 2000, 'TOPUP_APPROVED');
    await walletService.creditBalance(riderDbId, 3000, 'TOPUP_APPROVED');

    const balance = await walletService.getBalance(riderDbId);
    expect(balance).toBe(6000);

    const ledger = await walletRepository.getLedgerEntries(riderDbId);
    expect(ledger.length).toBe(3);
  });

  it('debit down to exactly zero', async () => {
    await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED');
    const balance = await walletService.debitBalance(riderDbId, 5000, 'RENT_DEBIT');
    expect(balance).toBe(0);
  });

  it('passes metadata fields (actorId, note) to ledger', async () => {
    const note = 'Test note';

    await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED', {
      note,
    });

    const ledger = await walletRepository.getLedgerEntries(riderDbId);
    expect(ledger).toHaveLength(1);
    expect(ledger[0].note).toBe(note);
  });


  describe('LedgerEntryType to category mapping', () => {
    const creditTypes: Array<string> = [
      'TOPUP_SUBMITTED',
      'TOPUP_APPROVED',
      'DEPOSIT_CREDIT',
      'REWARD_CREDIT',
    ];

    const debitTypes: Array<string> = [
      'RENT_DEBIT',
      'FINE_DEBIT',
    ];

    for (const type of creditTypes) {
      it(`creditBalance with type ${type} creates a CREDIT ledger entry`, async () => {
        await walletService.creditBalance(riderDbId, 1000, type as any);
        const ledger = await walletRepository.getLedgerEntries(riderDbId);
        expect(ledger.length).toBeGreaterThanOrEqual(1);
        const last = ledger[0];
        expect(last.entryType).toBe('CREDIT');
        expect(last.amountInPaise).toBe(1000);
      });
    }

    for (const type of debitTypes) {
      it(`debitBalance with type ${type} creates a DEBIT ledger entry`, async () => {
        await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED');
        await walletService.debitBalance(riderDbId, 1000, type as any);
        const ledger = await walletRepository.getLedgerEntries(riderDbId);
        const debitEntry = ledger.find(e => e.entryType === 'DEBIT');
        expect(debitEntry).toBeDefined();
        expect(debitEntry!.amountInPaise).toBe(1000);
      });
    }

    it('creditBalance with REVERSAL type creates a CREDIT ledger entry', async () => {
      await walletService.creditBalance(riderDbId, 2000, 'REVERSAL' as any);
      const ledger = await walletRepository.getLedgerEntries(riderDbId);
      expect(ledger[0].entryType).toBe('CREDIT');
    });

    it('creditBalance with ADMIN_ADJUSTMENT creates a CREDIT ledger entry', async () => {
      await walletService.creditBalance(riderDbId, 500, 'ADMIN_ADJUSTMENT' as any);
      const ledger = await walletRepository.getLedgerEntries(riderDbId);
      expect(ledger[0].entryType).toBe('CREDIT');
    });

    it('creditBalance with DEPOSIT_REFUND type creates a CREDIT ledger entry', async () => {
      await walletService.creditBalance(riderDbId, 3000, 'DEPOSIT_REFUND' as any);
      const ledger = await walletRepository.getLedgerEntries(riderDbId);
      expect(ledger[0].entryType).toBe('CREDIT');
    });

    it('creditBalance with TOPUP_REJECTED type creates a CREDIT ledger entry', async () => {
      await walletService.creditBalance(riderDbId, 100, 'TOPUP_REJECTED' as any);
      const ledger = await walletRepository.getLedgerEntries(riderDbId);
      expect(ledger[0].entryType).toBe('CREDIT');
    });
  });

  it('fuzz testing creditBalance with extreme or invalid amounts', async () => {
    // Only test valid extreme amounts? Wait, if we pass negative amounts it should throw.
    // walletService accepts amount as parameter. What if it's negative, infinity or NaN?
    // Let's ensure the service rejects negative amounts and NaN.
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.double({ max: -1, noDefaultInfinity: true, noNaN: true }),
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity)
        ),
        async (amount) => {
          await expect(walletService.creditBalance(riderDbId, amount, 'TOPUP_APPROVED'))
            .rejects.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  it('fuzz testing debitBalance with extreme negative amounts or NaNs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.double({ max: -1, noDefaultInfinity: true, noNaN: true }),
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity)
        ),
        async (amount) => {
          await expect(walletService.debitBalance(riderDbId, amount, 'RENT_DEBIT'))
            .rejects.toThrow();
        }
      ),
      { numRuns: 20 }
    );
  });

  describe('verifyIntegrity', () => {
    it('should verify integrity successfully when there is no drift', async () => {
      await walletService.creditBalance(riderDbId, 5000, 'TOPUP_APPROVED');
      const result = await walletService.verifyIntegrity(riderDbId);
      expect(result.ok).toBe(true);
      expect(result.drift).toBe(0);
    });

    it('should return ok=false for non-existent rider wallet', async () => {
      const result = await walletService.verifyIntegrity('invalid-rider');
      expect(result.ok).toBe(false);
      expect(result.walletBalance).toBe(0);
    });
  });

  describe('backfillOpeningBalance', () => {
    it('should backfill opening balance', async () => {
      await expect(walletService.backfillOpeningBalance(riderDbId)).resolves.toBeUndefined();
    });
  });
});


