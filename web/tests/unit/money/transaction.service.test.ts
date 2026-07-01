import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { transactionService } from '../../../src/server/modules/transactions/transaction.service';
import { TransactionType, TransactionPurpose, TransactionStatus } from '@prisma/client';

describe('transactionService', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  let riderDbId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
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
  });

  describe('requireTransaction', () => {
    it('returns the transaction if it exists', async () => {
      const txn = await testDb.transaction.create({
        data: {
          riderId: riderDbId,
          type: TransactionType.CREDIT,
          amount: 5000,
          purpose: TransactionPurpose.TOP_UP,
          status: TransactionStatus.PENDING,
        }
      });
      const res = await transactionService.requireTransaction(txn.id);
      expect(res.id).toBe(txn.id);
    });

    it('throws if transaction not found', async () => {
      await expect(transactionService.requireTransaction('invalid-id')).rejects.toThrow('Transaction not found');
    });
  });

  describe('validateTransition', () => {
    it('validates a valid transition', () => {
      expect(() => transactionService.validateTransition('PENDING', 'APPROVED')).not.toThrow();
    });

    it('throws on invalid transition', () => {
      expect(() => transactionService.validateTransition('APPROVED', 'PENDING')).toThrow();
    });
  });
});
