/**
 * Rentals module - Types
 *
 * Rental plan, booking, pickup, active rental, and return types.
 */

export type RentalStatus =
  | 'NO_RENTAL'
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
  pricePaise: number;
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
  dailyRatePaise: number;
  rentPaidUntil?: Date;
}
