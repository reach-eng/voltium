/**
 * Onboarding module — Types
 *
 * Manages the rider onboarding workflow: profile submission, KYC, guarantor,
 * deposit, plan selection, and pickup scheduling.
 */

export interface OnboardingProgress {
  profileCompleted: boolean;
  kycCompleted: boolean;
  guarantorCompleted: boolean;
  depositCompleted: boolean;
  planCompleted: boolean;
  pickupCompleted: boolean;
  currentStep: OnboardingStep;
}

export type OnboardingStep =
  | 'PROFILE'
  | 'KYC'
  | 'GUARANTOR'
  | 'DEPOSIT'
  | 'PLAN'
  | 'PICKUP'
  | 'COMPLETE';

export interface OnboardingState {
  riderId: string;
  riderDbId: string;
  progress: OnboardingProgress;
  completedAt?: Date;
}
