/**
 * Transactions module - Types
 *
 * Transaction records, filters, and bulk operation types.
 */

import type { TransactionStatus } from './transaction-state-machine';

export type { TransactionStatus };

export type TransactionType = 'CREDIT' | 'DEBIT';

export type TransactionPurpose =
  | 'TOP_UP'
  | 'SECURITY_DEPOSIT'
  | 'RENT_PAYMENT'
  | 'REWARD'
  | 'REFUND'
  | 'REVERSAL'
  | 'ADMIN_ADJUSTMENT'
  | 'REFERRAL_REWARD';

export interface TransactionFilter {
  status?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  riderId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortDir?: string;
}

export interface TransactionListResult {
  transactions: Record<string, unknown>[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TransactionApproval {
  transactionId: string;
  action: 'APPROVE' | 'REJECT' | 'REVERSE';
  rejectionReason?: string;
  walletCreditAmount?: number;
}

export interface BulkActionInput {
  ids: string[];
  action: string;
  value?: string;
}
