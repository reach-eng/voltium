/**
 * Deposits module - Service.
 *
 * Core deposit business logic: approval validation, idempotency, refund calculation.
 * Delegates to lib/services/deposit-service.ts for the actual state-machine-safe operations
 * and to wallet-ledger.service.ts for ledger-backed balance mutations.
 *
 * Rules:
 *   - Approval is idempotent (ledger idempotency key prevents double-credit)
 *   - Minimum deposit amount is enforced at the use-case layer
 *   - State transitions are validated by the deposit state machine
 *   - All finance actions create audit log entries
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { validateDepositTransition } from './deposit-state-machine';
import type { DepositStatus } from './deposit.types';

export const depositService = {
  /**
   * Validates that a deposit approval is safe to perform.
   * Returns { approved: true } if the deposit can be approved.
   * Returns { approved: false, reason } if already approved or invalid state.
   */
  async validateApproval(riderDbId: string): Promise<{ approved: boolean; reason?: string }> {
    const record = await db.depositRecord.findUnique({
      where: { riderId: riderDbId },
    });

    if (!record) {
      return { approved: false, reason: 'No deposit record found' };
    }

    // Check if already approved → skip (idempotent)
    if (record.status === 'APPROVED') {
      return { approved: false, reason: 'Deposit already approved' };
    }

    // Validate state transition
    const currentStatus = record.status as DepositStatus;
    try {
      validateDepositTransition(currentStatus, 'APPROVED');
    } catch {
      return { approved: false, reason: `Cannot approve deposit in status ${currentStatus}` };
    }

    return { approved: true };
  },

  /**
   * Validates that a rejection is safe to perform.
   */
  async validateRejection(riderDbId: string): Promise<{ valid: boolean; reason?: string }> {
    const record = await db.depositRecord.findUnique({
      where: { riderId: riderDbId },
    });

    if (!record) {
      return { valid: false, reason: 'No deposit record found' };
    }

    const currentStatus = record.status as DepositStatus;
    try {
      validateDepositTransition(currentStatus, 'REJECTED');
    } catch {
      return { valid: false, reason: `Cannot reject deposit in status ${currentStatus}` };
    }

    return { valid: true };
  },

  /**
   * Calculates the refund-eligible amount for a deposit.
   */
  getRefundEligibleAmount(status: DepositStatus, amountInPaise: number): number {
    switch (status) {
      case 'APPROVED':
        return amountInPaise;
      case 'PARTIALLY_REFUNDED':
        return 0; // Track remaining refundable via deposit record
      default:
        return 0;
    }
  },

  /**
   * Creates audit log entries for deposit actions.
   */
  async logAction(params: {
    riderId: string;
    adminId: string;
    action: 'deposit.approve' | 'deposit.reject' | 'deposit.refund' | 'deposit.forfeit';
    details?: Record<string, unknown>;
  }): Promise<void> {
    await createAuditLog({
      actorId: params.adminId,
      actorType: 'admin',
      action: params.action,
      entity: 'depositRecord',
      entityId: params.riderId,
      details: params.details ?? {},
    }).catch((err) => {
      logger.error('[DepositService] Failed to create audit log', err);
    });
  },
};
