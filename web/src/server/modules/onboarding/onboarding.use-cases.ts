/**
 * Onboarding module — Use cases
 *
 * Orchestrates the multi-step rider onboarding flow: profile, KYC, guarantor,
 * deposit, plan selection, and pickup.
 */

import { db } from '@/lib/db';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import type { OnboardingProgress, OnboardingStep } from './onboarding.types';

export const onboardingUseCases = {
  async getProgress(riderDbId: string): Promise<OnboardingProgress> {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        lifecycleStatus: true,
        kycProfile: { select: { status: true } },
        guarantor: { select: { status: true } },
      },
    });

    if (!rider) throw new Error('Rider not found');

    const lifecycleRank: Record<string, number> = {
      NEW: 0, PHONE_VERIFIED: 1, PROFILE_SUBMITTED: 2, KYC_SUBMITTED: 3,
      KYC_APPROVED: 4, GUARANTOR_SUBMITTED: 5, GUARANTOR_APPROVED: 6,
      DEPOSIT_PENDING: 7, DEPOSIT_APPROVED: 8, PLAN_SELECTED: 9,
      PICKUP_SCHEDULED: 10, ACTIVE: 11, SUSPENDED: 12,
      RETURN_PENDING: 13, CLOSED: 14,
    };
    const rank = lifecycleRank[rider.lifecycleStatus] ?? 0;
    const kycCompleted = rank >= 4 || rider.kycProfile?.status === 'APPROVED';
    const guarantorCompleted = rider.guarantor?.status === 'APPROVED';

    return {
      profileCompleted: rank >= 2,
      kycCompleted,
      guarantorCompleted,
      depositCompleted: rank >= 8,
      planCompleted: rank >= 9,
      pickupCompleted: rank >= 10,
      currentStep: this.determineCurrentStep(rider),
    };
  },

  determineCurrentStep(rider: {
    lifecycleStatus: string;
  }): OnboardingStep {
    const lifecycleRank: Record<string, number> = {
      NEW: 0, PHONE_VERIFIED: 1, PROFILE_SUBMITTED: 2, KYC_SUBMITTED: 3,
      KYC_APPROVED: 4, GUARANTOR_SUBMITTED: 5, GUARANTOR_APPROVED: 6,
      DEPOSIT_PENDING: 7, DEPOSIT_APPROVED: 8, PLAN_SELECTED: 9,
      PICKUP_SCHEDULED: 10, ACTIVE: 11, SUSPENDED: 12,
      RETURN_PENDING: 13, CLOSED: 14,
    };
    const rank = lifecycleRank[rider.lifecycleStatus] ?? 0;
    if (rank < 2) return 'PROFILE';
    if (rank < 4) return 'KYC';
    if (rank < 8) return 'DEPOSIT';
    if (rank < 9) return 'PLAN';
    if (rank < 10) return 'PICKUP';
    return 'COMPLETE';
  },

  async autoProvisionTestRider(riderDbId: string, _phone: string) {
    const testVehicle = await db.vehicle.findFirst({ where: { status: 'AVAILABLE' } }) || await db.vehicle.findFirst();
    if (!testVehicle) return null;
    await transitionRiderStatus(riderDbId, 'ACTIVE');
    await db.rider.update({
      where: { id: riderDbId },
      data: {
        fullName: 'Test Rider', assignedVehicle: testVehicle.vehicleNumber, vehicleId: testVehicle.id,
        kycDoneAt: new Date(),
        depositDoneAt: new Date(), planDoneAt: new Date(),
        pickedUpAt: new Date(), registrationDoneAt: new Date(),
        currentPlan: 'Weekly Premium',
        planStartDate: new Date(), planEndDate: new Date(Date.now() + 7 * 86400000),
      },
    });
    await db.vehicle.update({ where: { id: testVehicle.id }, data: { status: 'ASSIGNED' } });
    await db.guarantor.upsert({
      where: { riderId: riderDbId },
      create: { riderId: riderDbId, name: 'Test Guarantor', relation: 'Father', phone: '9876543211', status: 'APPROVED' },
      update: { status: 'APPROVED' },
    });
    return db.rider.findUnique({
      where: { id: riderDbId },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });
  },
};
