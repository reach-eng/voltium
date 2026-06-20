/**
 * Onboarding module — Repository
 *
 * Data access layer for rider onboarding state.
 */

import { db } from '@/server/shared/db/prisma';
import type { OnboardingProgress } from './onboarding.types';

export const onboardingRepository = {
  async getProgress(riderDbId: string): Promise<OnboardingProgress | null> {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        lifecycleStatus: true,
      },
    });

    if (!rider) return null;

    const lifecycleRank: Record<string, number> = {
      NEW: 0,
      PHONE_VERIFIED: 1,
      PROFILE_SUBMITTED: 2,
      KYC_SUBMITTED: 3,
      KYC_APPROVED: 4,
      GUARANTOR_SUBMITTED: 5,
      GUARANTOR_APPROVED: 6,
      DEPOSIT_PENDING: 7,
      DEPOSIT_APPROVED: 8,
      PLAN_SELECTED: 9,
      PICKUP_SCHEDULED: 10,
      ACTIVE: 11,
      SUSPENDED: 12,
      RETURN_PENDING: 13,
      CLOSED: 14,
    };
    const rank = lifecycleRank[rider.lifecycleStatus] ?? 0;
    return {
      profileCompleted: rank >= 2,
      kycCompleted: rank >= 4,
      guarantorCompleted: false,
      depositCompleted: rank >= 8,
      planCompleted: rank >= 9,
      pickupCompleted: rank >= 10,
      currentStep: 'PROFILE',
    };
  },
};
