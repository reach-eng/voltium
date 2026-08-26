import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { transactionRepository } from '../../../src/server/modules/transactions/transaction.repository';
import { TransactionType, TransactionPurpose, TransactionStatus } from '@prisma/client';

describe('transactionRepository', () => {

  let riderDbId: string;
  let txnId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
    const riderId = `RD-${uuidv4().substring(0, 12)}`;
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 12)}`;
    
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
        amountInPaise: 5000,
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

    it('filters by type CREDIT', async () => {
      const res = await transactionRepository.list({ riderId: riderDbId, type: TransactionType.CREDIT });
      expect(res.transactions).toHaveLength(1);
    });

    it('filters by type DEBIT returns empty when no debit transactions', async () => {
      const res = await transactionRepository.list({ riderId: riderDbId, type: TransactionType.DEBIT });
      expect(res.transactions).toHaveLength(0);
    });

    it('returns correct pagination metadata', async () => {
      const res = await transactionRepository.list({ riderId: riderDbId, page: 1, limit: 10 });
      expect(res.pagination).toMatchObject({
        page: 1,
        limit: 10,
        totalPages: expect.any(Number),
        total: expect.any(Number),
      });
    });

    it('returns empty for non-existent riderId', async () => {
      const res = await transactionRepository.list({ riderId: 'non-existent-id' });
      expect(res.transactions).toHaveLength(0);
      expect(res.pagination.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('finds transaction by id', async () => {
      const txn = await transactionRepository.findById(txnId);
      expect(txn?.id).toBe(txnId);
    });

    it('returns null for non-existent id', async () => {
      const txn = await transactionRepository.findById('non-existent-id');
      expect(txn).toBeNull();
    });
  });

  describe('findByRiderId', () => {
    it('finds transaction by rider id with rupee conversion', async () => {
      const res = await transactionRepository.findByRiderId(riderDbId);
      expect(res.transactions).toHaveLength(1);
      expect(res.transactions[0].amount).toBe(50);
    });

    it('returns correct default pagination', async () => {
      const res = await transactionRepository.findByRiderId(riderDbId);
      expect(res.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('returns empty for non-existent rider', async () => {
      const res = await transactionRepository.findByRiderId('non-existent-rider');
      expect(res.transactions).toHaveLength(0);
      expect(res.pagination.total).toBe(0);
    });

    it('respects page/limit parameters', async () => {
      // Create a second transaction for the same rider
      await testDb.transaction.create({
        data: {
          riderId: riderDbId,
          type: TransactionType.DEBIT,
          amountInPaise: 2000,
          purpose: TransactionPurpose.RENT_PAYMENT,
          status: TransactionStatus.PENDING,
        }
      });

      const page1 = await transactionRepository.findByRiderId(riderDbId, 1, 1);
      expect(page1.transactions).toHaveLength(1);
      expect(page1.pagination.total).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);

      const page2 = await transactionRepository.findByRiderId(riderDbId, 2, 1);
      expect(page2.transactions).toHaveLength(1);
      // The two transactions should be different
      expect(page2.transactions[0].id).not.toBe(page1.transactions[0].id);
    });
  });

  describe('updateStatus', () => {
    it('updates status and approvedAt when APPROVED', async () => {
      await transactionRepository.updateStatus(txnId, TransactionStatus.APPROVED, 'admin-1');
      const txn = await testDb.transaction.findUnique({ where: { id: txnId } });
      expect(txn?.status).toBe(TransactionStatus.APPROVED);
      expect(txn?.approvedBy).toBe('admin-1');
      expect(txn?.approvedAt).not.toBeNull();
    });

    it('updates status and sets rejectionReason when REJECTED', async () => {
      await transactionRepository.updateStatus(txnId, TransactionStatus.REJECTED, 'admin-1', 'Fake proof');
      const txn = await testDb.transaction.findUnique({ where: { id: txnId } });
      expect(txn?.status).toBe(TransactionStatus.REJECTED);
      expect(txn?.approvedAt).not.toBeNull();
      expect(txn?.rejectionReason).toBe('Fake proof');
    });

    it('updates to FAILED without approvedAt', async () => {
      await transactionRepository.updateStatus(txnId, TransactionStatus.FAILED);
      const txn = await testDb.transaction.findUnique({ where: { id: txnId } });
      expect(txn?.status).toBe(TransactionStatus.FAILED);
      expect(txn?.approvedAt).toBeNull();
    });
  });

  describe('deleteByRiderId', () => {
    it('deletes transactions by rider id', async () => {
      await transactionRepository.deleteByRiderId(riderDbId);
      const res = await transactionRepository.findByRiderId(riderDbId);
      expect(res.transactions).toHaveLength(0);
    });

    it('is safe to call when no transactions exist', async () => {
      const newRiderId = uuidv4();
      const result = await transactionRepository.deleteByRiderId(newRiderId);
      // deleteMany returns { count: 0 } when nothing matched
      expect(result.count).toBe(0);
    });
  });
});


