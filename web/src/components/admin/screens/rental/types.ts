import { Badge } from '@/components/ui/badge';

/**
 * R3.7y split — Rental Management types & display helpers.
 */

export interface RentalPlan {
  id: string;
  name: string;
  type: string;
  price: number;
  securityDeposit: number;
  isSecurityRefundable: boolean;
  refundableAfterDays: number | null;
  durationDays: number;
  description: string | null;
  additionalInfo: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ActiveRental {
  id: string;
  riderId: string;
  fullName: string | null;
  name: string | null;
  phone: string;
  rentalStatus: string;
  lifecycleStatus: string;
  currentPlan: string | null;
  assignedVehicle: string | null;
  vehicleId: string | null;
  returnPending?: boolean;
  submissionDate?: string | null;
  scooterSubmissionDate?: string | null;
  photoFront?: string | null;
  photoBack?: string | null;
  photoLeft?: string | null;
  photoRight?: string | null;
  photoSpeedometer?: string | null;
}

export type PlanType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export const PLAN_TYPE_DURATIONS: Record<PlanType, number> = {
  DAILY: 1,
  WEEKLY: 7,
  MONTHLY: 30,
};

export const PLAN_TYPE_OPTIONS: { value: PlanType; label: string }[] = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

export const PLAN_TYPE_BADGE_CLASS: Record<string, string> = {
  DAILY: 'border-blue-500/20 text-blue-600 bg-blue-500/5 dark:text-blue-400',
  WEEKLY:
    'border-purple-500/20 text-purple-600 bg-purple-500/5 dark:text-purple-400',
  MONTHLY:
    'border-emerald-500/20 text-emerald-600 bg-emerald-500/5 dark:text-emerald-400',
};

export interface PlanFormState {
  name: string;
  type: PlanType;
  price: string;
  securityDeposit: string;
  isSecurityRefundable: boolean;
  refundableAfterDays: string;
  description: string;
  additionalInfo: string;
  isActive: boolean;
}

export const EMPTY_PLAN_FORM: PlanFormState = {
  name: '',
  type: 'DAILY',
  price: '',
  securityDeposit: '0',
  isSecurityRefundable: true,
  refundableAfterDays: '',
  description: '',
  additionalInfo: '',
  isActive: true,
};

export function countSubmittedPhotos(rental: ActiveRental): number {
  return [
    rental.photoFront,
    rental.photoBack,
    rental.photoLeft,
    rental.photoRight,
    rental.photoSpeedometer,
  ].filter(Boolean).length;
}

export function riderDisplayName(rental: ActiveRental): string {
  return rental.fullName || rental.name || '-';
}

// Suppress unused-import warning for Badge (kept for potential future use)
void Badge;
