import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupTestPostgres, teardownTestPostgres, testDb } from '../../_setup/test-postgres';
import { depositLedgerService } from '../../../src/server/modules/deposits/deposit-ledger.service';
import { DepositStatus } from '@prisma/client';
import { walletRepository } from '../../../src/server/modules/wallet/wallet.repository';

describe('depositLedgerService', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
    await setupTestPostgres();
  });

  afterAll(async () => {
    await teardownTestPostgres();
  });

  let riderDbId: string;
  let transactionId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
    transactionId = `txn-${uuidv4()}`;
    const riderId = `RD-${uuidv4().substring(0, 6)}`;
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

    await testDb.transaction.create({
      data: {
        id: transactionId,
        riderId: riderDbId,
        type: 'CREDIT',
        amount: 5000,
        purpose: 'SECURITY_DEPOSIT',
        status: 'PENDING',
        method: 'RAZORPAY',
        receipt: 'pay_123',
      }
    });
  });

  it.skip('should upsert record', async () => {
    // TODO: Fails intermittently with "Can't reach database server" when
    // run as part of the full unit test suite. Root cause: shared Prisma
    // connection pool fills up across test files. See wallet.service.test.ts
    // for the same issue.

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
    expect(wallet?.securityDeposit).toBe(5000);
    
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
      data: { securityDeposit: 5000 },
    });

    await depositLedgerService.refund({
      riderId: riderDbId,
      adminId: 'admin-1',
    });

    const record = await testDb.depositRecord.findUnique({ where: { riderId: riderDbId } });
    expect(record?.status).toBe('REFUNDED');

    const wallet = await testDb.wallet.findUnique({ where: { riderId: riderDbId } });
    expect(wallet?.securityDeposit).toBe(0);
  });
});
