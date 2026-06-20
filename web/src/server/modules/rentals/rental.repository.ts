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
import { validateRiderTransition } from '@/server/modules/riders/rider-lifecycle.state-machine';
import { Prisma } from '@prisma/client';

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

    const result = await db.rider.updateMany({
      where: { id: riderDbId, lifecycleStatus: rider?.lifecycleStatus },
      data: {
        currentPlan: planId,
        lifecycleStatus: 'PLAN_SELECTED',
      },
    });

    if (result.count === 0) {
      throw new RentalStateError(
        `Rental state transition race condition for rider ${riderDbId}`,
        currentStatus,
        'PLAN_SELECTED'
      );
    }

    return db.rider.findUnique({ where: { id: riderDbId } });
  },

  async startRental(riderDbId: string, vehicleId: string, hubId: string, teamLeader: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { lifecycleStatus: true },
    });

    const currentStatus: RentalStatus = (rider?.lifecycleStatus as any as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'ACTIVE');

    const result = await db.rider.updateMany({
      where: { id: riderDbId, lifecycleStatus: rider?.lifecycleStatus },
      data: {
        lifecycleStatus: 'ACTIVE',
        vehicleId,
        pickupHub: hubId,
        teamLeader,
        planStartDate: new Date(),
      },
    });

    if (result.count === 0) {
      throw new RentalStateError(
        `Rental state transition race condition for rider ${riderDbId}`,
        currentStatus,
        'ACTIVE'
      );
    }

    return db.rider.findUnique({ where: { id: riderDbId } });
  },

  async endRental(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { lifecycleStatus: true },
    });

    const currentStatus: RentalStatus = (rider?.lifecycleStatus as any as RentalStatus) || 'NO_RENTAL';
    validateRentalTransition(currentStatus, 'RETURN_PENDING');

    const result = await db.rider.updateMany({
      where: { id: riderDbId, lifecycleStatus: rider?.lifecycleStatus },
      data: {
        lifecycleStatus: 'RETURN_PENDING',
      },
    });

    if (result.count === 0) {
      throw new RentalStateError(
        `Rental state transition race condition for rider ${riderDbId}`,
        currentStatus,
        'RETURN_PENDING'
      );
    }

    return db.rider.findUnique({ where: { id: riderDbId } });
  },

  async findManyLeases(args: any) {
    return db.rentalLease.findMany(args);
  },

  async countLeases(args: any) {
    return db.rentalLease.count(args);
  },

  async findLeaseById(id: string) {
    return db.rentalLease.findUnique({
      where: { id },
      include: { rider: true, vehicle: true },
    });
  },

  async executeLeaseAction(lease: any, action: string) {
    return db.$transaction(async (tx: Prisma.TransactionClient) => {
      const currentStatus = lease.rider.lifecycleStatus;

      if (action === 'START' || action === 'PICKUP_COMPLETE') {
        validateRiderTransition(currentStatus, 'ACTIVE');
        await tx.vehicle.update({ where: { id: lease.vehicleId }, data: { status: 'ACTIVE_RENTAL', assignedAt: new Date() } });
        await tx.rider.update({ where: { id: lease.riderId }, data: { lifecycleStatus: 'ACTIVE', vehicleId: lease.vehicleId, assignedVehicle: lease.vehicle.vehicleId, pickedUpAt: new Date() } });
        return tx.rentalLease.update({ where: { id: lease.id }, data: { status: 'ACTIVE' } });
      }
      if (action === 'MARK_OVERDUE') return tx.rentalLease.update({ where: { id: lease.id }, data: { status: 'OVERDUE' } });
      if (action === 'REQUEST_RETURN') {
        validateRiderTransition(currentStatus, 'RETURN_PENDING');
        await tx.vehicle.update({ where: { id: lease.vehicleId }, data: { status: 'RETURN_PENDING' } });
        await tx.rider.update({ where: { id: lease.riderId }, data: { lifecycleStatus: 'RETURN_PENDING' } });
        return tx.rentalLease.update({ where: { id: lease.id }, data: { status: 'RETURN_PENDING' } });
      }
      if (action === 'APPROVE_RETURN' || action === 'CLOSE') {
        validateRiderTransition(currentStatus, 'CLOSED');
        await tx.vehicle.update({ where: { id: lease.vehicleId }, data: { status: 'AVAILABLE', assignedAt: null } });
        await tx.rider.update({ where: { id: lease.riderId }, data: { lifecycleStatus: 'CLOSED', vehicleId: null, assignedVehicle: null } });
        return tx.rentalLease.update({ where: { id: lease.id }, data: { status: 'CLOSED', endTime: new Date().toTimeString().slice(0, 5) } });
      }
      if (action === 'SUSPEND') {
        validateRiderTransition(currentStatus, 'SUSPENDED');
        await tx.rider.update({ where: { id: lease.riderId }, data: { lifecycleStatus: 'SUSPENDED' } });
        return tx.rentalLease.update({ where: { id: lease.id }, data: { status: 'SUSPENDED' } });
      }
      throw new Error(`Unsupported rental action: ${action}`);
    });
  },
};
