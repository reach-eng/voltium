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
        registrationDone: true,
        kycDone: true,
        depositDone: true,
        planDone: true,
        pickupDone: true,
      },
    });

    if (!rider) return null;

    return {
      profileCompleted: rider.registrationDone,
      kycCompleted: rider.kycDone,
      guarantorCompleted: false,
      depositCompleted: rider.depositDone,
      planCompleted: rider.planDone,
      pickupCompleted: rider.pickupDone,
      currentStep: 'PROFILE',
    };
  },
};
