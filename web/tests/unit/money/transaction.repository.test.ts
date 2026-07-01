import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { setupTestPostgres, teardownTestPostgres, testDb } from '../../_setup/test-postgres';
import { transactionRepository } from '../../../src/server/modules/transactions/transaction.repository';
import { TransactionType, TransactionPurpose, TransactionStatus } from '@prisma/client';

describe.skip('transactionRepository', () => {
  // TODO: This file's beforeEach fails intermittently with
  // "Can't reach database server" when run as part of the full unit test
  // suite. Root cause: the shared Prisma connection pool (size 10) fills
  // up across the 55+ test files run before this one. Fix requires either
  // per-file connection scoping or a global teardown that drains the pool.

  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
    await setupTestPostgres();
  });

  afterAll(async () => {
    await teardownTestPostgres();
  });

  let riderDbId: string;
  let txnId: string;

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

    const txn = await testDb.transaction.create({
      data: {
        riderId: riderDbId,
        type: TransactionType.CREDIT,
        amount: 5000,
        purpose: TransactionPurpose.TOP_UP,
        status: TransactionStatus.PENDING,
      }
    });
    txnId = txn.id;
  });

  describe('list', () => {
    it.skip('returns paginated transactions with rupee conversion', async () => {
      // TODO: Test passes in isolation but fails in full suite because
      // setupTestPostgres() does `prisma db push --accept-data-loss` which
      // wipes data when other test files run their beforeAll. Needs proper
      // test isolation (e.g., per-file schema or transaction rollback).

      const res = await transactionRepository.list({ riderId: riderDbId });
      expect(res.transactions).toHaveLength(1);
      expect(res.transactions[0].amount).toBe(50); // 5000 paise = 50 rupees
      expect(res.pagination.total).toBe(1);
    });

    it('filters by status', async () => {
      const res = await transactionRepository.list({ riderId: riderDbId, status: TransactionStatus.PENDING });
      expect(res.transactions).toHaveLength(1);

      const emptyRes = await transactionRepository.list({ riderId: riderDbId, status: TransactionStatus.APPROVED });
      expect(emptyRes.transactions).toHaveLength(0);
    });
  });

  describe('findById', () => {
    it('finds transaction by id', async () => {
      const txn = await transactionRepository.findById(txnId);
      expect(txn?.id).toBe(txnId);
    });
  });

  describe('findByRiderId', () => {
    it('finds transaction by rider id with rupee conversion', async () => {
      const res = await transactionRepository.findByRiderId(riderDbId);
      expect(res.transactions).toHaveLength(1);
      expect(res.transactions[0].amount).toBe(50);
    });
  });

  describe('updateStatus', () => {
    it('updates status and approvedAt', async () => {
      await transactionRepository.updateStatus(txnId, TransactionStatus.APPROVED, 'admin-1');
      const txn = await testDb.transaction.findUnique({ where: { id: txnId } });
      expect(txn?.status).toBe(TransactionStatus.APPROVED);
      expect(txn?.approvedBy).toBe('admin-1');
      expect(txn?.approvedAt).not.toBeNull();
    });
  });

  describe('deleteByRiderId', () => {
    it('deletes transactions by rider id', async () => {
      await transactionRepository.deleteByRiderId(riderDbId);
      const res = await transactionRepository.findByRiderId(riderDbId);
      expect(res.transactions).toHaveLength(0);
    });
  });
});
