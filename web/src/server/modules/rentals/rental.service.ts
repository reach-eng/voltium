/**
 * Rentals module - Service.
 *
 * Core rental business logic: pricing, overdue detection, rent calculations.
 */

import type { RentalStatus, RentalPlanType } from './rental.types';

export const rentalService = {
  calculateDailyRate(planType: RentalPlanType, basePricePaise: number): number {
    switch (planType) {
      case 'DAILY':
        return basePricePaise;
      case 'WEEKLY':
        return Math.round(basePricePaise / 7);
      case 'MONTHLY':
        return Math.round(basePricePaise / 30);
    }
  },

  isOverdue(rentPaidUntil?: Date): boolean {
    if (!rentPaidUntil) return false;
    return new Date() > rentPaidUntil;
  },

  calculateLateFee(daysOverdue: number, dailyRatePaise: number): number {
    // TODO: Get late fee settings from config
    const lateFeeRate = 0.1; // 10% per day
    return Math.round(dailyRatePaise * lateFeeRate * daysOverdue);
  },
};
