import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { transactionService, TransactionServiceError } from '../../../src/server/modules/transactions/transaction.service';
import {
  validateTransactionTransition,
  canTransitionTransaction,
  TransactionStateError,
} from '../../../src/server/modules/transactions/transaction-state-machine';
import { TransactionType, TransactionPurpose, TransactionStatus } from '@prisma/client';

describe('transactionService', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
  });

  let riderDbId: string;

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
  });

  describe('requireTransaction', () => {
    it('returns the transaction if it exists', async () => {
      const txn = await testDb.transaction.create({
        data: {
          riderId: riderDbId,
          type: TransactionType.CREDIT,
          amountInPaise: 5000,
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

    it('thrown error is a TransactionServiceError with NOT_FOUND code', async () => {
      let err: TransactionServiceError | undefined;
      try {
        await transactionService.requireTransaction('no-such-id');
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeInstanceOf(TransactionServiceError);
      expect(err!.code).toBe('NOT_FOUND');
    });
  });

  describe('validateTransition', () => {
    it('validates a valid transition', () => {
      expect(() => transactionService.validateTransition('PENDING', 'APPROVED')).not.toThrow();
    });

    it('throws on invalid transition', () => {
      expect(() => transactionService.validateTransition('APPROVED', 'PENDING')).toThrow();
    });

    it('throws on same-to-same (no loop / duplicate transition)', () => {
      expect(() => transactionService.validateTransition('PENDING', 'PENDING')).toThrow();
    });

    it('allows PENDING → REJECTED', () => {
      expect(() => transactionService.validateTransition('PENDING', 'REJECTED')).not.toThrow();
    });

    it('allows PENDING → FAILED', () => {
      expect(() => transactionService.validateTransition('PENDING', 'FAILED')).not.toThrow();
    });

    it('allows APPROVED → REVERSED', () => {
      expect(() => transactionService.validateTransition('APPROVED', 'REVERSED')).not.toThrow();
    });

    it('allows APPROVED → REFUNDED', () => {
      expect(() => transactionService.validateTransition('APPROVED', 'REFUNDED')).not.toThrow();
    });

    it('allows REJECTED → PENDING', () => {
      expect(() => transactionService.validateTransition('REJECTED', 'PENDING')).not.toThrow();
    });

    it('allows FAILED → PENDING', () => {
      expect(() => transactionService.validateTransition('FAILED', 'PENDING')).not.toThrow();
    });

    it('throws on REVERSED → PENDING (terminal state)', () => {
      expect(() => transactionService.validateTransition('REVERSED', 'PENDING')).toThrow();
    });

    it('throws on REFUNDED → APPROVED (terminal state)', () => {
      expect(() => transactionService.validateTransition('REFUNDED', 'APPROVED')).toThrow();
    });
  });

  describe('logAction', () => {
    it('creates an audit log entry', async () => {
      // It should just not throw since audit logs are fire-and-forget in the service.
      await expect(transactionService.logAction({
        actorId: 'admin-id',
        action: 'APPROVE',
        transactionId: 'txn-123',
        details: { reason: 'test' }
      })).resolves.not.toThrow();
    });

    it('creates an audit log entry without optional details', async () => {
      await expect(transactionService.logAction({
        actorId: 'admin-id',
        action: 'REJECT',
        transactionId: 'txn-456',
      })).resolves.not.toThrow();
    });
  });
});

describe('transaction-state-machine', () => {
  describe('validateTransactionTransition', () => {
    it('allows PENDING → APPROVED', () => {
      expect(() => validateTransactionTransition('PENDING', 'APPROVED')).not.toThrow();
    });

    it('allows PENDING → REJECTED', () => {
      expect(() => validateTransactionTransition('PENDING', 'REJECTED')).not.toThrow();
    });

    it('allows PENDING → FAILED', () => {
      expect(() => validateTransactionTransition('PENDING', 'FAILED')).not.toThrow();
    });

    it('allows APPROVED → REVERSED', () => {
      expect(() => validateTransactionTransition('APPROVED', 'REVERSED')).not.toThrow();
    });

    it('allows APPROVED → REFUNDED', () => {
      expect(() => validateTransactionTransition('APPROVED', 'REFUNDED')).not.toThrow();
    });

    it('allows REJECTED → PENDING', () => {
      expect(() => validateTransactionTransition('REJECTED', 'PENDING')).not.toThrow();
    });

    it('allows FAILED → PENDING', () => {
      expect(() => validateTransactionTransition('FAILED', 'PENDING')).not.toThrow();
    });

    it('throws on same-to-same', () => {
      expect(() => validateTransactionTransition('PENDING', 'PENDING')).toThrow(TransactionStateError);
    });

    it('throws for REVERSED → PENDING (terminal)', () => {
      expect(() => validateTransactionTransition('REVERSED', 'PENDING')).toThrow(TransactionStateError);
    });

    it('throws for REFUNDED → PENDING (terminal)', () => {
      expect(() => validateTransactionTransition('REFUNDED', 'PENDING')).toThrow(TransactionStateError);
    });

    it('throws for APPROVED → PENDING (backwards)', () => {
      expect(() => validateTransactionTransition('APPROVED', 'PENDING')).toThrow(TransactionStateError);
    });

    it('throws for PENDING → REVERSED (skipping APPROVED)', () => {
      expect(() => validateTransactionTransition('PENDING', 'REVERSED')).toThrow(TransactionStateError);
    });

    it('error includes currentStatus and targetStatus properties', () => {
      let err: TransactionStateError | undefined;
      try {
        validateTransactionTransition('REVERSED', 'APPROVED');
      } catch (e: any) {
        err = e;
      }
      expect(err).toBeInstanceOf(TransactionStateError);
      expect(err!.currentStatus).toBe('REVERSED');
      expect(err!.targetStatus).toBe('APPROVED');
      expect(err!.message).toContain('none'); // REVERSED has no allowed transitions
    });
  });

  describe('canTransitionTransaction', () => {
    it('returns true for PENDING → APPROVED', () => {
      expect(canTransitionTransaction('PENDING', 'APPROVED')).toBe(true);
    });

    it('returns false for REVERSED → PENDING', () => {
      expect(canTransitionTransaction('REVERSED', 'PENDING')).toBe(false);
    });

    it('returns false for REFUNDED → APPROVED', () => {
      expect(canTransitionTransaction('REFUNDED', 'APPROVED')).toBe(false);
    });

    it('returns false for same-to-same', () => {
      expect(canTransitionTransaction('APPROVED', 'APPROVED')).toBe(false);
    });
  });
});


