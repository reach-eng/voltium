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
});
