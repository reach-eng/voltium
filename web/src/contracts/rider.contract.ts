/**
 * Rider Profile API Contract — request/response DTOs for rider profile routes.
 */

import type { ApiResponseSuccess } from '@/lib/api-response';

// ── GET /api/rider/profile ─────────────────────────────────────────────

export interface RiderProfileResponse {
  riderId: string;
  phone: string;
  fullName: string;
  email?: string;
  state: string;
  accountStatus: string;
  kycStatus: string;
  guarantorStatus: string;
  walletBalance: number;
  balance: number;
  securityDeposit: number;
  depositStatus: string;
  paymentStreak: number;
  rentalStatus: string;
  currentPlan?: string;
  planStatus: string;
  referralCode: string;
  referredBy?: string;
  unreadNotificationCount: number;
  totalRewardPoints: number;
  registrationDone: boolean;
  depositDone: boolean;
  kycDone: boolean;
  planDone: boolean;
  pickupDone: boolean;
  returnPending: boolean;
  [key: string]: unknown;
}

// ── PUT /api/rider/profile ─────────────────────────────────────────────

export interface UpdateProfileRequest {
  fullName?: string;
  email?: string;
  fatherName?: string;
  motherName?: string;
  currentAddress?: string;
  emergencyContact?: string;
  dob?: string;
  intent?: 'deliver' | 'personal';
  // KYC fields
  aadhaarFront?: string;
  aadhaarBack?: string;
  panCard?: string;
  bankName?: string;
  bankAccount?: string;
  bankIfsc?: string;
  // Guarantor fields
  guarantorName?: string;
  guarantorPhone?: string;
  guarantorRelation?: string;
  // Return fields
  returnPending?: boolean;
  returnPhotos?: string[];
  returnReason?: string;
}

export type RiderProfileApiResponse = ApiResponseSuccess<RiderProfileResponse>;
