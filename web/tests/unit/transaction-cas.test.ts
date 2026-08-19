/**
 * TG-5 (financial audit P0-2) — compare-and-swap status claim.
 *
 * Two admins approving the same PENDING transaction used to both write
 * APPROVED (blind `update`), producing two audit entries with different
 * adminIds. The repository now claims the status with an `updateMany`
 * gated on the expected status: the first claim wins, the second matches
 * 0 rows and throws TransactionServiceError('...', 'CONFLICT'), which the
 * route serializes as 409.
 *
 * Wallet double-credit is prevented separately by the ledger's
 * idempotencyKey replay guard (P0-9 adds the key to the bonus credit).
 */

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../_setup/test-postgres';
import { transactionRepository } from '../../src/server/modules/transactions/transaction.repository';
import { TransactionServiceError } from '../../src/server/modules/transactions/transaction.service';

describe('Transaction CAS status claim (P0-2 / TG-5)', () => {
  beforeEach(async () => {
    await testDb.transaction.deleteMany();
    await testDb.rider.deleteMany();
  });

  afterAll(async () => {
    await testDb.transaction.deleteMany();
    await testDb.rider.deleteMany();
  });

  async function seedPendingTransaction() {
    const rider = await testDb.rider.create({
      data: {
        id: uuidv4(),
        riderId: uuidv4(),
        referralCode: uuidv4().slice(0, 8),
        phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      },
    });
    return testDb.transaction.create({
      data: {
        riderId: rider.id,
        type: 'CREDIT',
        amountInPaise: 100000,
        purpose: 'TOP_UP',
      },
    });
  }

  it('first approve claims PENDING→APPROVED and returns the canonical row', async () => {
    const txn = await seedPendingTransaction();

    const result = await transactionRepository.updateStatus(
      txn.id,
      'PENDING',
      'APPROVED',
      'admin-1'
    );

    expect(result.status).toBe('APPROVED');
    expect(result.approvedBy).toBe('admin-1');
    expect(result.approvedAt).toBeInstanceOf(Date);
  });

  it('second concurrent approve loses the CAS race and throws CONFLICT', async () => {
    const txn = await seedPendingTransaction();

    await transactionRepository.updateStatus(txn.id, 'PENDING', 'APPROVED', 'admin-1');

    const second = transactionRepository.updateStatus(txn.id, 'PENDING', 'APPROVED', 'admin-2');
    await expect(second).rejects.toBeInstanceOf(TransactionServiceError);
    await expect(second).rejects.toMatchObject({ code: 'CONFLICT' });

    // The row is untouched by the loser — still approved by admin-1 only.
    const after = await testDb.transaction.findUnique({ where: { id: txn.id } });
    expect(after?.status).toBe('APPROVED');
    expect(after?.approvedBy).toBe('admin-1');
  });

  it('rejecting twice serializes the second attempt as CONFLICT', async () => {
    const txn = await seedPendingTransaction();

    await transactionRepository.updateStatus(txn.id, 'PENDING', 'REJECTED', 'admin-1', 'nope');
    const second = transactionRepository.updateStatus(
      txn.id,
      'PENDING',
      'REJECTED',
      'admin-2',
      'also nope'
    );
    await expect(second).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('a legit sequential transition (APPROVED→REVERSED) still works', async () => {
    const txn = await seedPendingTransaction();

    await transactionRepository.updateStatus(txn.id, 'PENDING', 'APPROVED', 'admin-1');
    const reversed = await transactionRepository.updateStatus(
      txn.id,
      'APPROVED',
      'REVERSED',
      'admin-1'
    );
    expect(reversed.status).toBe('REVERSED');
  });
});
