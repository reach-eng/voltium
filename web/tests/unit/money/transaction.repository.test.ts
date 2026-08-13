import { describe, it, expect, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { transactionRepository } from '../../../src/server/modules/transactions/transaction.repository';
import { TransactionType, TransactionPurpose, TransactionStatus, TransactionAudience } from '@prisma/client';

// TEST-STRATEGY-AUDIT T-P0-2 (2026-08-08, reverted 2026-08-08):
// the previously-skipped test on line ~60 was targeted for
// re-enabling via a per-file schema (tests/_setup/per-file-schema.ts).
// The per-file schema approach failed in the test runner with
// "permission denied to create database" — the `voltium_user`
// (from .env) doesn't have CREATEDB privilege, and the
// process.env.DATABASE_URL change in beforeAll is too late for
// the `db` singleton (already initialized at import time).
//
// The skipped test stays skipped. Tracked as T-P0-2-backfill.
// usePerFileSchema(__filename);  // disabled — see T-P0-2-backfill

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
        // H6-2026-08-13: TOP_UP is a user-initiated purpose. In
        // production, walletRepository.createTransaction sets
        // audience=USER; here we set it explicitly to keep the test
        // data realistic without depending on that helper.
        audience: TransactionAudience.USER,
        status: TransactionStatus.PENDING,
      }
    });
    txnId = txn.id;
  });

  describe('list', () => {
    it.skip('returns paginated transactions with rupee conversion', async () => {
      // TEST-STRATEGY-AUDIT T-P0-2 (reverted 2026-08-08): the
      // per-file schema pattern from `tests/_setup/per-file-schema.ts`
      // was tried but failed in the test runner with
      // "permission denied to create database" — the `voltium_user`
      // (from .env) doesn't have CREATEDB privilege, and the
      // process.env.DATABASE_URL change in beforeAll is too late
      // for the `db` singleton (already initialized at import time).
      //
      // The original `it.skip` is restored. The test would need a
      // full integration test setup (real Postgres + transactions)
      // to verify this end-to-end, which is out of scope for the
      // audit. Tracked as T-P0-2-backfill.
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
          // H6-2026-08-13: SYSTEM is the default, but explicit for clarity
          // in mixed-purpose test data.
          audience: TransactionAudience.SYSTEM,
          status: TransactionStatus.PENDING,
        }
      });

      // H6-2026-08-13: pass 'ALL' so the pagination test sees both rows
      // regardless of audience. (Default is USER which would hide
      // the RENT_PAYMENT row.)
      const page1 = await transactionRepository.findByRiderId(riderDbId, 1, 1, 'ALL');
      expect(page1.transactions).toHaveLength(1);
      expect(page1.pagination.total).toBe(2);
      expect(page1.pagination.totalPages).toBe(2);

      const page2 = await transactionRepository.findByRiderId(riderDbId, 2, 1, 'ALL');
      expect(page2.transactions).toHaveLength(1);
      // The two transactions should be different
      expect(page2.transactions[0].id).not.toBe(page1.transactions[0].id);
    });

    // H6-2026-08-13: audience filter behavior on rider history.
    it('defaults to USER audience — hides system flows (RENT_PAYMENT)', async () => {
      // Mix a user-initiated top-up (already created in beforeEach as TOP_UP)
      // with a system flow (RENT_PAYMENT).
      await testDb.transaction.create({
        data: {
          riderId: riderDbId,
          type: TransactionType.DEBIT,
          amountInPaise: 2000,
          purpose: TransactionPurpose.RENT_PAYMENT,
          audience: TransactionAudience.SYSTEM,
          status: TransactionStatus.PENDING,
        },
      });
      // Also a reversal (system)
      await testDb.transaction.create({
        data: {
          riderId: riderDbId,
          type: 'CREDIT' as TransactionType,
          amountInPaise: 2000,
          purpose: TransactionPurpose.REVERSAL,
          audience: TransactionAudience.SYSTEM,
          status: TransactionStatus.PENDING,
        },
      });

      // Default (no audience arg) → USER only
      const userOnly = await transactionRepository.findByRiderId(riderDbId);
      expect(userOnly.transactions).toHaveLength(1);
      expect(userOnly.pagination.total).toBe(1);
      expect(userOnly.transactions[0].purpose).toBe(TransactionPurpose.TOP_UP);
      expect(userOnly.transactions[0].audience).toBe(TransactionAudience.USER);

      // Explicit USER → same result
      const userExplicit = await transactionRepository.findByRiderId(
        riderDbId,
        1,
        20,
        'USER'
      );
      expect(userExplicit.transactions).toHaveLength(1);
      expect(userExplicit.pagination.total).toBe(1);

      // SYSTEM only → the two system rows
      const systemOnly = await transactionRepository.findByRiderId(
        riderDbId,
        1,
        20,
        'SYSTEM'
      );
      expect(systemOnly.transactions).toHaveLength(2);
      expect(systemOnly.pagination.total).toBe(2);
      const purposes = systemOnly.transactions.map((t) => t.purpose).sort();
      expect(purposes).toEqual(['RENT_PAYMENT', 'REVERSAL']);

      // ALL → all 3 rows
      const all = await transactionRepository.findByRiderId(
        riderDbId,
        1,
        20,
        'ALL'
      );
      expect(all.transactions).toHaveLength(3);
      expect(all.pagination.total).toBe(3);
    });
  });

  describe('updateStatus', () => {
    it('updates status and approvedAt when APPROVED', async () => {
      // P0-2: CAS signature — (id, expectedStatus, newStatus, ...)
      await transactionRepository.updateStatus(txnId, TransactionStatus.PENDING, TransactionStatus.APPROVED, 'admin-1');
      const txn = await testDb.transaction.findUnique({ where: { id: txnId } });
      expect(txn?.status).toBe(TransactionStatus.APPROVED);
      expect(txn?.approvedBy).toBe('admin-1');
      expect(txn?.approvedAt).not.toBeNull();
    });

    it('updates status and sets rejectionReason when REJECTED — no approvedAt stamp (P1-16)', async () => {
      await transactionRepository.updateStatus(txnId, TransactionStatus.PENDING, TransactionStatus.REJECTED, 'admin-1', 'Fake proof');
      const txn = await testDb.transaction.findUnique({ where: { id: txnId } });
      expect(txn?.status).toBe(TransactionStatus.REJECTED);
      expect(txn?.approvedAt).toBeNull();
      expect(txn?.rejectionReason).toBe('Fake proof');
    });

    it('updates to FAILED without approvedAt', async () => {
      await transactionRepository.updateStatus(txnId, TransactionStatus.PENDING, TransactionStatus.FAILED);
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


