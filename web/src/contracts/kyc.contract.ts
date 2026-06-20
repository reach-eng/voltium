/**
 * KYC API Contract — request/response DTOs for KYC routes.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── POST /api/rider/kyc ────────────────────────────────────────────────

export interface SubmitKycRequest {
  aadhaarNumber: string;
  panNumber: string;
  bankName: string;
  bankAccount: string;
  bankIfsc: string;
  aadhaarFront?: string;
  aadhaarBack?: string;
  panCard?: string;
  profilePhoto?: string;
  signature?: string;
}

export interface SubmitKycResponse {
  id: string;
  riderId: string;
  kycStatus: string;
}

// ── GET /api/rider/kyc ─────────────────────────────────────────────────

export interface KycStatusResponse {
  kycStatus: string;
  profilePhoto: string | null;
  riderPhoto: string | null;
  signature: string | null;
  aadhaarFront: string | null;
  aadhaarBack: string | null;
  panCard: string | null;
  bankName: string | null;
  rejectionReason?: string | null;
}

// ── POST /api/admin/kyc (review) ───────────────────────────────────────

export interface ReviewKycRequest {
  riderId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_INFO';
  rejectionReason?: string;
  infoRequest?: string;
}

export type SubmitKycApiResponse = ApiResponseSuccess<SubmitKycResponse>;
export type KycStatusApiResponse = ApiResponseSuccess<KycStatusResponse>;
