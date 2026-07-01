import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupTestPostgres, teardownTestPostgres, testDb } from '../../_setup/test-postgres';
import { walletLedgerService } from '../../../src/server/modules/wallet/wallet-ledger.service';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';
import { LedgerCategory } from '@prisma/client';

describe('walletLedgerService', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
    await setupTestPostgres();
  });

  afterAll(async () => {
    await teardownTestPostgres();
  });

  let riderId: string;
  let riderDbId: string;
  let walletId: string;

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

    const wallet = await testDb.wallet.create({
      data: {
        riderId: riderDbId,
        balanceInPaise: 0,
        securityDeposit: 0,
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
    expect(wallet?.securityDeposit).toBe(5000);

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
});
