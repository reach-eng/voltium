/**
 * Deposit Ledger Service — module-level wrapper around src/lib/services/deposit-service.ts
 *
 * Provides a clean module interface for deposit workflow operations.
 * All state transitions are validated against the deposit state machine.
 *
 * CRITICAL RULE: Deposit approval must be idempotent — double-approve must not double-credit.
 */

import {
  approveDeposit as libApproveDeposit,
  rejectDeposit as libRejectDeposit,
  refundDeposit as libRefundDeposit,
  forfeitDeposit as libForfeitDeposit,
  upsertDepositRecord as libUpsertDepositRecord,
  DepositStateError,
} from '@/lib/services/deposit-service';

export { DepositStateError };

export const depositLedgerService = {
  /**
   * Upserts a DepositRecord when a rider submits their first deposit payment.
   * Call after the Transaction row is created (still PENDING).
   */
  async upsertRecord(params: { riderId: string; transactionId: string; amountInPaise: number }) {
    return libUpsertDepositRecord(params);
  },

  /**
   * Approves a deposit — idempotent (safe to call multiple times).
   * Credits securityDeposit on wallet, optionally adds welcome bonus.
   */
  async approve(params: { riderId: string; adminId: string; bonusAmountInPaise?: number }) {
    return libApproveDeposit(params);
  },

  /**
   * Rejects a deposit — no wallet change, records reason.
   */
  async reject(params: { riderId: string; adminId: string; reason: string }) {
    return libRejectDeposit(params);
  },

  /**
   * Refunds a deposit — credits the refund amount back to wallet balance.
   */
  async refund(params: {
    riderId: string;
    adminId: string;
    refundAmountInPaise?: number;
    note?: string;
  }) {
    return libRefundDeposit(params);
  },

  /**
   * Forfeits a deposit — debits securityDeposit without crediting balance.
   */
  async forfeit(params: { riderId: string; adminId: string; reason: string }) {
    return libForfeitDeposit(params);
  },
};
