/**
 * Riders module - Types
 *
 * Rider profile, lifecycle, and device management types.
 */

export type RiderLifecycleStatus =
  | 'NEW'
  | 'PHONE_VERIFIED'
  | 'PROFILE_SUBMITTED'
  | 'KYC_SUBMITTED'
  | 'KYC_APPROVED'
  | 'GUARANTOR_SUBMITTED'
  | 'GUARANTOR_APPROVED'
  | 'DEPOSIT_PENDING'
  | 'DEPOSIT_APPROVED'
  | 'PLAN_SELECTED'
  | 'PICKUP_SCHEDULED'
  | 'ACTIVE'
  | 'SUSPENDED'
  | 'RETURN_PENDING'
  | 'CLOSED';

export interface RiderProfileUpdate {
  riderId: string;
  fullName?: string;
  email?: string;
  fatherName?: string;
  motherName?: string;
  currentAddress?: string;
  emergencyContact?: string;
  dob?: string;
  intent?: 'deliver' | 'personal';
}

export interface RiderState {
  riderId: string;
  phone: string;
  fullName: string;
  lifecycleStatus: RiderLifecycleStatus;
  isOnboarded: boolean;
  kycStatus: string;
  guarantorStatus: string;
  depositStatus: string;
  rentalStatus: string;
  activePlan: unknown | null;
  assignedVehicle: unknown | null;
  walletBalance: number;
}
