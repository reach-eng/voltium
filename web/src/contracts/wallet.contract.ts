/**
 * Wallet & Deposit API Contract — request/response DTOs for money routes.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── Wallet ─────────────────────────────────────────────────────────────

export interface WalletBalanceResponse {
  riderId: string;
  balanceInPaise: number;
  balance: number; // In rupees
  securityDeposit: number;
  depositStatus: string;
  paymentStreak: number;
  pendingTopups?: number;
}

// ── Top-up ───────────────────────────────────────────────────────────

export interface TopupRequest {
  amount: number;
  purpose?: string;
  method: 'UPI' | 'CASH' | 'CARD';
  upiRef?: string;
  proofUrl?: string;
}

export interface TopupResponse {
  id: string;
  amount: number;
  status: string;
  idempotent?: boolean;
}

// ── Admin - Deposit Review ───────────────────────────────────────────

export interface ReviewDepositRequest {
  riderId: string;
  action: 'APPROVE' | 'REJECT' | 'REFUND' | 'FORFEIT';
  reason?: string;
  refundAmount?: number;
  bonusAmount?: number;
}

export interface ReviewDepositResponse {
  riderId: string;
  status: string;
}

// ── Admin - Transaction Approval ─────────────────────────────────────

export interface ApproveTransactionRequest {
  id: string;
  action: 'APPROVE' | 'REJECT' | 'REVERSE';
  rejectionReason?: string;
  walletCreditAmount?: number;
}

export interface ApproveTransactionResponse {
  id: string;
  status: string;
  amount: number;
}

export type WalletBalanceApiResponse = ApiResponseSuccess<WalletBalanceResponse>;
export type TopupApiResponse = ApiResponseSuccess<TopupResponse>;
export type ReviewDepositApiResponse = ApiResponseSuccess<ReviewDepositResponse>;
export type ApproveTransactionApiResponse = ApiResponseSuccess<ApproveTransactionResponse>;
