/**
 * Auth module - Types
 *
 * Authentication, session, and OTP management types.
 */

export interface OtpEntry {
  phone: string;
  otp: string;
  expiresAt: Date;
  attempts: number;
}

export interface SendOtpInput {
  phone: string;
}

export interface VerifyOtpInput {
  phone?: string;
  otp?: string;
  idToken?: string;
  referralCode?: string;
}

export interface VerifyOtpResult {
  riderId: string;
  riderDbId: string;
  phone: string;
  isNewRider: boolean;
  token: string;
  riderData: Record<string, unknown>;
}

export type OtpStatus = 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'MAX_ATTEMPTS';
