/**
 * Rentals module - Repository.
 *
 * Data access for rental plans, bookings, active rentals, and return records.
 * All rental status transitions are validated against the rental state machine.
 *
 * Note: The Rider model stores rental state directly. Return photos/reason
 * are stored in the VehicleReturn model (not Rider).
 */

import { db } from '@/lib/db';
import { validateRentalTransition, RentalStateError } from './rental-state-machine';
import type { RentalStatus } from './rental.types';

export const rentalRepository = {
  async findPlans() {
    return db.rentalPlan.findMany({ where: { isActive: true } });
  },

  async findPlanById(planId: string) {
    return db.rentalPlan.findUnique({ where: { id: planId } });
  },

  async findActiveRental(riderDbId: string) {
    return db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        id: true,
        lifecycleStatus: true,
        currentPlan: true,
        assignedVehicle: true,
        pickupHub: true,
        planStartDate: true,
        planEndDate: true,
      },
    });
  },

  async selectPlan(riderDbId: string, planId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { lifecycleStatus: true },
    });

    const currentStatus: RentalStatus = (rider?.lifecycleStatus as any as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'PLAN_SELECTED');

    return db.rider.update({
      where: { id: riderDbId },
      data: {
        currentPlan: planId,
        lifecycleStatus: 'PLAN_SELECTED',
      },
    });
  },

  async startRental(riderDbId: string, vehicleId: string, hubId: string, teamLeader: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { lifecycleStatus: true },
    });

    const currentStatus: RentalStatus = (rider?.lifecycleStatus as any as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'ACTIVE');

    return db.rider.update({
      where: { id: riderDbId },
      data: {
        lifecycleStatus: 'ACTIVE',
        vehicleId,
        pickupHub: hubId,
        teamLeader,
        planStartDate: new Date(),
      },
    });
  },

  async endRental(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { lifecycleStatus: true },
    });

    const currentStatus: RentalStatus = (rider?.lifecycleStatus as any as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'RETURN_PENDING');

    return db.rider.update({
      where: { id: riderDbId },
      data: {
        lifecycleStatus: 'RETURN_PENDING',
      },
    });
  },
};
