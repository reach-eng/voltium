/**
 * Onboarding module — Use cases
 *
 * Orchestrates the multi-step rider onboarding flow: profile, KYC, guarantor,
 * deposit, plan selection, and pickup.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type { OnboardingProgress, OnboardingStep } from './onboarding.types';

export const onboardingUseCases = {
  async getProgress(riderDbId: string): Promise<OnboardingProgress> {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        registrationDone: true,
        kycDone: true,
        depositDone: true,
        planDone: true,
        pickupDone: true,
        kycProfile: { select: { status: true } },
        guarantor: { select: { status: true } },
      },
    });

    if (!rider) throw new Error('Rider not found');

    const kycCompleted = rider.kycDone || rider.kycProfile?.status === 'APPROVED';
    const guarantorCompleted = rider.guarantor?.status === 'VERIFIED' || rider.guarantor?.status === 'APPROVED';

    return {
      profileCompleted: rider.registrationDone,
      kycCompleted,
      guarantorCompleted,
      depositCompleted: rider.depositDone,
      planCompleted: rider.planDone,
      pickupCompleted: rider.pickupDone,
      currentStep: this.determineCurrentStep(rider),
    };
  },

  determineCurrentStep(rider: {
    registrationDone: boolean;
    kycDone: boolean;
    depositDone: boolean;
    planDone: boolean;
    pickupDone: boolean;
  }): OnboardingStep {
    if (!rider.registrationDone) return 'PROFILE';
    if (!rider.kycDone) return 'KYC';
    if (!rider.depositDone) return 'DEPOSIT';
    if (!rider.planDone) return 'PLAN';
    if (!rider.pickupDone) return 'PICKUP';
    return 'COMPLETE';
  },

  async autoProvisionTestRider(riderDbId: string, phone: string) {
    const testVehicle = await db.vehicle.findFirst({ where: { status: 'AVAILABLE' } }) || await db.vehicle.findFirst();
    if (!testVehicle) return null;
    await db.rider.update({
      where: { id: riderDbId },
      data: {
        fullName: 'Test Rider', assignedVehicle: testVehicle.vehicleNumber, vehicleId: testVehicle.id,
        rentalStatus: 'ACTIVE', accountStatus: 'ACTIVE', kycDone: true, kycDoneAt: new Date(),
        depositDone: true, depositDoneAt: new Date(), planDone: true, planDoneAt: new Date(),
        pickupDone: true, pickedUpAt: new Date(), registrationDone: true, registrationDoneAt: new Date(),
        state: 'ACTIVE', planStatus: 'ACTIVE', currentPlan: 'Weekly Premium',
        planStartDate: new Date(), planEndDate: new Date(Date.now() + 7 * 86400000),
      },
    });
    await db.vehicle.update({ where: { id: testVehicle.id }, data: { status: 'ASSIGNED' } });
    await db.guarantor.upsert({
      where: { riderId: riderDbId },
      create: { riderId: riderDbId, name: 'Test Guarantor', relation: 'Father', phone: '9876543211', status: 'VERIFIED' },
      update: { status: 'VERIFIED' },
    });
    return db.rider.findUnique({
      where: { id: riderDbId },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });
  },
};
