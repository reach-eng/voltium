/**
 * Rentals module - Types
 *
 * PR-ONBOARDING-2026-08-11 (audit 2.19): the previous file diverged
 * from the Prisma `RentalPlan` / `RentalLease` models. The `RentalStatus`
 * union was missing `BOOKED` (used by the booking flow) and the plan
 * `pricePaise` field name was the legacy `*Paise` short-form; the
 * Prisma column is `priceInPaise`. Brought back into sync.
 */

export type RentalStatus =
  | 'NO_RENTAL'
  | 'BOOKED'
  | 'PLAN_SELECTED'
  | 'PICKUP_SCHEDULED'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'RETURN_PENDING'
  | 'RETURN_APPROVED'
  | 'CLOSED'
  | 'SUSPENDED';

export type RentalPlanType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface RentalPlan {
  id: string;
  name: string;
  type: RentalPlanType;
  priceInPaise: number;
  securityDepositInPaise?: number;
  durationDays: number;
  description?: string;
  isActive: boolean;
}

export interface ActiveRental {
  id: string;
  riderId: string;
  planId: string;
  vehicleId: string;
  hubId: string;
  status: RentalStatus;
  startDate: Date;
  dueDate?: Date;
  endDate?: Date;
  basePriceInPaise: number;
  finalPriceInPaise: number;
  rentPaidUntil?: Date;
}
