/**
 * Transactions module - Service.
 *
 * Business rules for transaction approval, rejection, and reversal.
 * Delegates to wallet-ledger.service for actual balance mutations.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { validateTransactionTransition, TransactionStateError } from './transaction-state-machine';
import type { TransactionStatus } from './transaction.types';

export { TransactionStateError };

export const transactionService = {
  /**
   * Ensures a transaction exists and is in the expected status.
   */
  async requireTransaction(txnId: string) {
    const txn = await db.transaction.findUnique({ where: { id: txnId } });
    if (!txn) {
      throw new TransactionServiceError('Transaction not found', 'NOT_FOUND');
    }
    return txn;
  },

  /**
   * Validates a transaction status transition.
   */
  validateTransition(currentStatus: string, targetStatus: string) {
    validateTransactionTransition(
      currentStatus as TransactionStatus,
      targetStatus as TransactionStatus
    );
  },

  /**
   * Creates an audit log entry for a transaction action.
   *
   * P1-15 (financial audit): the old `.catch(err => logger.error(err))`
   * swallowed audit failures with no context — by the time this runs, the
   * wallet mutation and status claim have already committed, so a dropped
   * entry leaves the audit trail lying. Failures are now logged at error
   * level with the full action context so ops can backfill.
   */
  async logAction(params: {
    actorId: string;
    action: string;
    transactionId: string;
    details?: Record<string, unknown>;
  }) {
    try {
      await createAuditLog({
        actorId: params.actorId,
        action: params.action,
        entity: 'transaction',
        entityId: params.transactionId,
        details: params.details ?? {},
      });
    } catch (err) {
      logger.error('[TransactionService] Audit log failed — backfill required', {
        error: err instanceof Error ? err.message : String(err),
        action: params.action,
        transactionId: params.transactionId,
        actorId: params.actorId,
      });
    }
  },
};

export class TransactionServiceError extends Error {
  code: string;
  constructor(message: string, code = 'TRANSACTION_ERROR') {
    super(message);
    this.name = 'TransactionServiceError';
    this.code = code;
  }
}
