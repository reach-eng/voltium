/**
 * Onboarding module — Use cases
 *
 * Orchestrates the multi-step rider onboarding flow: profile, KYC, guarantor,
 * deposit, plan selection, and pickup.
 */

import { db } from '@/lib/db';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { transitionRiderStatus } from '@/server/modules/riders/rider-lifecycle.service';
import type { RiderLifecycleStatus } from '@/server/modules/riders/rider-lifecycle.service';
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

    // P1-12: shared lifecycle ranking (single source of truth).
    const rank = lifecycleRankOf(rider.lifecycleStatus);
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

  // PR-ONBOARDING-2026-08-11 (audit 5.2): type the lifecycleStatus as
  // RiderLifecycleStatus (typed) instead of `string`. Callers passing
  // a raw string get a type error; the canonical route loads the row
  // from Prisma which already returns a typed status.
  determineCurrentStep(rider: { lifecycleStatus: RiderLifecycleStatus }): OnboardingStep {
    // P1-12: shared lifecycle ranking (single source of truth).
    const rank = lifecycleRankOf(rider.lifecycleStatus);
    if (rank < 2) return 'PROFILE';
    if (rank < 4) return 'KYC';
    if (rank < 8) return 'DEPOSIT';
    if (rank < 9) return 'PLAN';
    if (rank < 10) return 'PICKUP';
    return 'COMPLETE';
  },

  async autoProvisionTestRider(riderDbId: string, _phone: string) {
    const testVehicle =
      (await db.vehicle.findFirst({ where: { status: 'AVAILABLE' } })) ||
      (await db.vehicle.findFirst());
    if (!testVehicle) return null;
    await transitionRiderStatus(riderDbId, 'ACTIVE');
    // Coalesce 3 independent writes into a single round-trip
    await db.$transaction([
      db.rider.update({
        where: { id: riderDbId },
        data: {
          fullName: 'Test Rider',
          assignedVehicle: testVehicle.vehicleNumber,
          vehicleId: testVehicle.id,
          kycDoneAt: new Date(),
          depositDoneAt: new Date(),
          planDoneAt: new Date(),
          pickedUpAt: new Date(),
          registrationDoneAt: new Date(),
          currentPlan: 'Weekly Premium',
          planStartDate: new Date(),
          planEndDate: new Date(Date.now() + 7 * 86400000),
        },
      }),
      db.vehicle.update({ where: { id: testVehicle.id }, data: { status: 'ASSIGNED' } }),
      db.guarantor.upsert({
        where: { riderId: riderDbId },
        create: {
          riderId: riderDbId,
          name: 'Test Guarantor',
          relation: 'Father',
          phone: '9876543211',
          status: 'APPROVED',
        },
        update: { status: 'APPROVED' },
      }),
    ]);
    return db.rider.findUnique({
      where: { id: riderDbId },
      include: { kycProfile: true, wallet: true, guarantor: true, vehicleReturns: true },
    });
  },
};
