/**
 * Auth API Contract — request/response DTOs for authentication routes.
 *
 * These types serve as the single source of truth for the Auth API shape.
 * Flutter consumes these through the generated API client.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── Send OTP ───────────────────────────────────────────────────────────

export interface SendOtpRequest {
  phone: string; // 10-digit phone number
}

export interface SendOtpResponse {
  exists: boolean;
  otp?: string; // Only in development
}

// ── Verify OTP ─────────────────────────────────────────────────────────

export interface VerifyOtpRequest {
  phone?: string;
  otp?: string;
  idToken?: string;
  referralCode?: string;
}

export interface RiderProfileOutput {
  riderId: string;
  phone: string;
  fullName: string;
  state: string;
  kycStatus: string;
  guarantorStatus: string;
  walletBalance: number;
  depositStatus: string;
  rentalStatus: string;
  referralCode: string;
  token: string;
  accountStatus: string;
  [key: string]: unknown; // Additional flattened fields
}

export type VerifyOtpResponse = RiderProfileOutput;

// ── Types ──────────────────────────────────────────────────────────────

export type SendOtpApiResponse = ApiResponseSuccess<SendOtpResponse>;
export type VerifyOtpApiResponse = ApiResponseSuccess<VerifyOtpResponse>;
