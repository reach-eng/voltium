/**
 * Rentals module - Service.
 *
 * Core rental business logic: pricing, overdue detection, rent calculations.
 */

import type { RentalStatus, RentalPlanType } from './rental.types';
import { APP_CONFIG } from '@/lib/config';

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
    const lateFeeRate = APP_CONFIG.LATE_FEE_RATE; // 10% per day
    return Math.round(dailyRatePaise * lateFeeRate * daysOverdue);
  },
};
