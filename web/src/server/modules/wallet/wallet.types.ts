/**
 * Wallet module - Types
 *
 * Wallet balance, ledger entries, and money-movement types.
 */

export type LedgerEntryType =
  | 'TOPUP_SUBMITTED'
  | 'TOPUP_APPROVED'
  | 'TOPUP_REJECTED'
  | 'RENT_DEBIT'
  | 'DEPOSIT_CREDIT'
  | 'DEPOSIT_REFUND'
  | 'REWARD_CREDIT'
  | 'FINE_DEBIT'
  | 'REVERSAL'
  | 'ADMIN_ADJUSTMENT';

export type LedgerDirection = 'CREDIT' | 'DEBIT';

export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'FAILED' | 'REVERSED' | 'REFUNDED';

export interface LedgerEntry {
  id: string;
  riderId: string;
  transactionId: string;
  type: LedgerEntryType;
  amountPaise: number;
  direction: LedgerDirection;
  balanceBeforePaise: number;
  balanceAfterPaise: number;
  status: TransactionStatus;
  idempotencyKey: string;
  createdBy: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface WalletBalance {
  riderId: string;
  balancePaise: number;
  pendingTopupsPaise: number;
  lastUpdated: Date;
}
