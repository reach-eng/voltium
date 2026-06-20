/**
 * Deposit API Contract — request/response DTOs for security deposit lifecycle.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── GET /api/rider/deposit ────────────────────────────────────────────

export interface DepositStatusResponse {
  riderId: string;
  status: 'NOT_SUBMITTED' | 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | 'REFUND_REQUESTED' | 'REFUNDED' | 'FORFEITED' | 'PARTIALLY_REFUNDED';
  amountInPaise: number;
  paidAt?: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  refundedAt?: string;
  refundedAmountInPaise?: number;
}

// ── POST /api/rider/deposit/submit ────────────────────────────────────

export interface SubmitDepositRequest {
  amount: number;
  proofUrl: string;
  method: 'UPI' | 'CASH' | 'CARD';
  upiRef?: string;
}

export interface SubmitDepositResponse {
  id: string;
  amount: number;
  status: string;
  message: string;
}

// ── Admin - POST /api/admin/deposits ──────────────────────────────────

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
  message: string;
}

export type DepositStatusApiResponse = ApiResponseSuccess<DepositStatusResponse>;
export type SubmitDepositApiResponse = ApiResponseSuccess<SubmitDepositResponse>;
export type ReviewDepositApiResponse = ApiResponseSuccess<ReviewDepositResponse>;
