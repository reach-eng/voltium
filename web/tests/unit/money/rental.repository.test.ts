import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { rentalRepository } from '../../../src/server/modules/rentals/rental.repository';

describe('rentalRepository', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
  });

  afterAll(async () => {
  });

  let riderDbId: string;
  let planId: string;
  let vehicleId: string;

  beforeEach(async () => {
    riderDbId = uuidv4();
    const riderId = `RD-${uuidv4().substring(0, 6)}`;
    const phone = Math.floor(Math.random() * 9000000000 + 1000000000).toString();
    const referralCode = `REF-${uuidv4().substring(0, 6)}`;
    
    await testDb.rider.create({
      data: {
        id: riderDbId,
        riderId: riderId,
        phone: phone,
        fullName: 'Test Rider',
        referralCode: referralCode,
        lifecycleStatus: 'DEPOSIT_APPROVED',
      },
    });

    const plan = await testDb.rentalPlan.create({
      data: {
        id: uuidv4(),
        name: 'Weekly Saver',
        type: 'WEEKLY',
        price: 14000,
        durationDays: 7,
        isActive: true,
      }
    });
    planId = plan.id;

    const vehicle = await testDb.vehicle.create({
      data: {
        id: uuidv4(),
        vehicleId: `VH-${uuidv4()}`,
        vehicleNumber: `MH04-${uuidv4()}`,
        model: 'EV-1',
        status: 'AVAILABLE',
        hub: {
          create: {
            id: uuidv4(),
            name: 'Main Hub',
            location: '123 Hub St',
          }
        }
      }
    });
    vehicleId = vehicle.id;
  });

  describe('findPlans', () => {
    it('returns active plans', async () => {
      const plans = await rentalRepository.findPlans();
      expect(plans.length).toBeGreaterThan(0);
      expect(plans.find(p => p.id === planId)).toBeDefined();
    });
  });

  describe('selectPlan', () => {
    it('updates rider lifecycle status and current plan', async () => {
      const rider = await rentalRepository.selectPlan(riderDbId, planId);
      expect(rider?.currentPlan).toBe(planId);
      expect(rider?.lifecycleStatus).toBe('PLAN_SELECTED');
    });
  });

  describe('startRental', () => {
    it('transitions to ACTIVE and sets vehicle details', async () => {
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'PLAN_SELECTED', currentPlan: planId },
      });

      const rider = await rentalRepository.startRental(riderDbId, vehicleId, 'hub-1', 'leader-1');
      expect(rider?.lifecycleStatus).toBe('ACTIVE');
      expect(rider?.vehicleId).toBe(vehicleId);
      expect(rider?.pickupHub).toBe('hub-1');
      expect(rider?.teamLeader).toBe('leader-1');
      expect(rider?.planStartDate).not.toBeNull();
    });
  });

  describe('endRental', () => {
    it('transitions from ACTIVE to RETURN_PENDING', async () => {
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'ACTIVE', currentPlan: planId, vehicleId },
      });

      const rider = await rentalRepository.endRental(riderDbId);
      expect(rider?.lifecycleStatus).toBe('RETURN_PENDING');
    });
  });

  describe('executeLeaseAction', () => {
    it('marks lease as START and updates rider and vehicle', async () => {
      await testDb.rider.update({
        where: { id: riderDbId },
        data: { lifecycleStatus: 'PICKUP_SCHEDULED', currentPlan: planId },
      });

      const shift = await testDb.shift.create({
        data: {
          id: uuidv4(),
          name: 'Morning Shift',
          startTime: '08:00',
          endTime: '12:00',
        }
      });

      const lease = await testDb.rentalLease.create({
        data: {
          id: uuidv4(),
          riderId: riderDbId,
          vehicleId: vehicleId,
          shiftId: shift.id,
          leaseDate: '2026-06-29',
          startTime: '09:00',
          status: 'BOOKED',
          basePrice: 14000,
          finalPrice: 14000,
        },
        include: { rider: true, vehicle: true },
      });

      const updatedLease = await rentalRepository.executeLeaseAction(lease, 'START');
      expect(updatedLease.status).toBe('ACTIVE');

      const rider = await testDb.rider.findUnique({ where: { id: riderDbId } });
      expect(rider?.lifecycleStatus).toBe('ACTIVE');

      const vehicle = await testDb.vehicle.findUnique({ where: { id: vehicleId } });
      expect(vehicle?.status).toBe('ACTIVE_RENTAL');
    });
  });
});
