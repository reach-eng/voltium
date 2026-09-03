import { describe, it, expect, vi, beforeEach } from 'vitest';

const m = vi.hoisted(() => {
  const db: any = {
    rider: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    rentalPlan: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    vehicle: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    teamLeader: {
      findFirst: vi.fn(),
    },
    hub: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(async (cb: any) => {
      if (typeof cb === 'function') {
        const tx = {
          rider: {
            update: vi.fn().mockResolvedValue({}),
            updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          },
        };
        return cb(tx);
      }
      return Promise.all(cb);
    }),
  };
  return {
    db,
    transitionRiderStatus: vi.fn().mockResolvedValue({ count: 1 }),
    ensureActiveRentalLease: vi.fn().mockResolvedValue({}),
    createAuditLog: vi.fn().mockResolvedValue({}),
    invalidateRiderCache: vi.fn(),
    invalidateVehicleCache: vi.fn(),
    getCachedRider: vi.fn(),
    getCachedRiderStatus: vi.fn(),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('@/lib/db', () => ({ db: m.db }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: m.createAuditLog }));
vi.mock('@/lib/cache', () => ({
  invalidateRiderCache: m.invalidateRiderCache,
  invalidateCache: vi.fn(),
}));
vi.mock('@/lib/server-cache', () => ({
  getCachedRider: m.getCachedRider,
  getCachedRiderStatus: m.getCachedRiderStatus,
  invalidateRiderCache: m.invalidateRiderCache,
  invalidateVehicleCache: m.invalidateVehicleCache,
  CACHE_TTLS: { rider: 300, vehicle: 300 },
}));
vi.mock('@/server/modules/riders/rider-lifecycle.service', () => ({
  transitionRiderStatus: m.transitionRiderStatus,
  validateTransition: vi.fn(),
}));
vi.mock('@/server/modules/rentals/rental.use-cases', () => ({
  ensureActiveRentalLease: m.ensureActiveRentalLease,
}));
vi.mock('@/server/modules/rentals/rental-state-machine', () => ({
  validateRentalTransition: vi.fn(),
  RentalStateError: class RentalStateError extends Error {},
}));

const { planUseCases } = await import('@/server/modules/plans/plan.use-cases');
const { adminRiderUseCases } = await import('@/server/modules/riders/admin-riders.use-cases');
const { rentalRepository } = await import('@/server/modules/rentals/rental.repository');

describe('F-05: Plan window starts at activation, not selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCachedRider.mockImplementation((id: string, fallback: any) => fallback());
    m.getCachedRiderStatus.mockImplementation((id: string, fallback: any) => fallback());
  });

  const weeklyPlan = {
    id: 'plan_weekly',
    name: 'Weekly Saver',
    type: 'WEEKLY',
    durationDays: 7,
    priceInPaise: 150000,
    securityDepositInPaise: 100000,
    isActive: true,
  };

  const dailyPlan = {
    id: 'plan_daily',
    name: 'Daily Commuter',
    type: 'DAILY',
    durationDays: 1,
    priceInPaise: 30000,
    securityDepositInPaise: 50000,
    isActive: true,
  };

  const monthlyPlan = {
    id: 'plan_monthly',
    name: 'Monthly Pro',
    type: 'MONTHLY',
    durationDays: 30,
    priceInPaise: 500000,
    securityDepositInPaise: 200000,
    isActive: true,
  };

  describe('planUseCases.subscribeToPlan', () => {
    it('does NOT start plan window for pre-active rider (leaves planStartDate and planEndDate null)', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_preactive',
        lifecycleStatus: 'KYC_APPROVED',
        requiresHigherDeposit: false,
      });
      m.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

      let updatedData: any = null;
      m.db.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          rider: {
            update: vi.fn().mockImplementation(({ data }: any) => {
              updatedData = data;
              return {};
            }),
            updateMany: vi.fn().mockImplementation(({ data }: any) => {
              updatedData = data;
              return { count: 1 };
            }),
          },
        };
        return cb(tx);
      });

      const result = await planUseCases.subscribeToPlan('rider_preactive', 'plan_weekly', false, 1000);

      expect(updatedData).not.toBeNull();
      expect(updatedData.lifecycleStatus).toBe('PLAN_SELECTED');
      expect(updatedData.planStartDate).toBeNull();
      expect(updatedData.planEndDate).toBeNull();
      expect(updatedData.currentPlan).toBe('Weekly Saver');
      expect(updatedData.currentPlanId).toBe('plan_weekly');

      expect(result.startDate).toBeNull();
      expect(result.endDate).toBeNull();
      expect(result.durationDays).toBe(7);
      expect(m.invalidateRiderCache).toHaveBeenCalledWith('rider_preactive');
    });

    it('starts plan window immediately if rider is already ACTIVE (renewal / switch)', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_active',
        lifecycleStatus: 'ACTIVE',
        requiresHigherDeposit: false,
      });
      m.db.rentalPlan.findUnique.mockResolvedValue(dailyPlan);

      let updatedData: any = null;
      m.db.$transaction.mockImplementation(async (cb: any) => {
        const tx = {
          rider: {
            update: vi.fn().mockImplementation(({ data }: any) => {
              updatedData = data;
              return {};
            }),
            updateMany: vi.fn().mockImplementation(({ data }: any) => {
              updatedData = data;
              return { count: 1 };
            }),
          },
        };
        return cb(tx);
      });

      const before = Date.now();
      const result = await planUseCases.subscribeToPlan('rider_active', 'plan_daily', false, 500);
      const after = Date.now();

      expect(updatedData).not.toBeNull();
      expect(updatedData.lifecycleStatus).toBe('ACTIVE');
      expect(updatedData.planStartDate).toBeInstanceOf(Date);
      expect(updatedData.planEndDate).toBeInstanceOf(Date);

      const startMs = updatedData.planStartDate.getTime();
      const endMs = updatedData.planEndDate.getTime();
      expect(startMs).toBeGreaterThanOrEqual(before);
      expect(startMs).toBeLessThanOrEqual(after);

      // DAILY duration is 1 day (86,400,000 ms)
      const diffMs = endMs - startMs;
      expect(diffMs).toBeCloseTo(86400000, -3);

      expect(result.startDate).toBe(updatedData.planStartDate.toISOString());
      expect(result.endDate).toBe(updatedData.planEndDate.toISOString());
      expect(result.durationDays).toBe(1);
    });
  });

  describe('adminRiderUseCases.assignPlan', () => {
    it('sets planStartDate and planEndDate to null for pre-active rider and transitions to PLAN_SELECTED', async () => {
      m.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_onboarding',
        lifecycleStatus: 'KYC_SUBMITTED',
      });
      m.db.rider.update.mockResolvedValue({ id: 'rider_onboarding' });

      await adminRiderUseCases.assignPlan('rider_onboarding', 'plan_weekly', 'admin_1', 'SUPER_ADMIN');

      expect(m.transitionRiderStatus).toHaveBeenCalledWith('rider_onboarding', 'PLAN_SELECTED');
      expect(m.db.rider.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rider_onboarding' },
          data: expect.objectContaining({
            currentPlan: 'Weekly Saver',
            currentPlanId: 'plan_weekly',
            planStartDate: null,
            planEndDate: null,
          }),
        })
      );
    });

    it('starts plan window from now if rider is already ACTIVE', async () => {
      m.db.rentalPlan.findUnique.mockResolvedValue(monthlyPlan);
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_active_admin',
        lifecycleStatus: 'ACTIVE',
      });
      m.db.rider.update.mockResolvedValue({ id: 'rider_active_admin' });

      const before = Date.now();
      await adminRiderUseCases.assignPlan('rider_active_admin', 'plan_monthly', 'admin_1', 'SUPER_ADMIN');

      // Should not transition ACTIVE to PLAN_SELECTED
      expect(m.transitionRiderStatus).not.toHaveBeenCalledWith('rider_active_admin', 'PLAN_SELECTED');

      const updateCall = m.db.rider.update.mock.calls[0][0];
      expect(updateCall.data.currentPlan).toBe('Monthly Pro');
      expect(updateCall.data.planStartDate).toBeInstanceOf(Date);
      expect(updateCall.data.planEndDate).toBeInstanceOf(Date);

      // MONTHLY duration is 30 days
      const diffMs = updateCall.data.planEndDate.getTime() - updateCall.data.planStartDate.getTime();
      expect(diffMs).toBeCloseTo(30 * 86400000, -3);
    });
  });

  describe('adminRiderUseCases.completePickup', () => {
    it('activates rider and initializes plan window starting at vehicle pickup activation (WEEKLY = 7 days)', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_pickup_1',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        currentPlan: 'Weekly Saver',
        currentPlanRef: weeklyPlan,
      });
      m.db.vehicle.findUnique.mockResolvedValue({
        id: 'v_1',
        vehicleNumber: 'VF-001',
        status: 'AVAILABLE',
      });
      m.db.vehicle.updateMany.mockResolvedValue({ count: 1 });
      m.db.hub.findUnique.mockResolvedValue({ id: 'hub_1', name: 'Central Hub' });
      m.db.vehicle.update.mockResolvedValue({});
      m.db.rider.update.mockResolvedValue({ id: 'rider_pickup_1', lifecycleStatus: 'ACTIVE' });

      const before = Date.now();
      await adminRiderUseCases.completePickup(
        'rider_pickup_1',
        { vehicleId: 'v_1', hubId: 'hub_1' },
        'admin_1',
        'SUPER_ADMIN'
      );
      const after = Date.now();

      expect(m.transitionRiderStatus).toHaveBeenCalledWith('rider_pickup_1', 'ACTIVE');
      expect(m.ensureActiveRentalLease).toHaveBeenCalled();

      const updateCall = m.db.rider.update.mock.calls[0][0];
      expect(updateCall.where).toEqual({ id: 'rider_pickup_1' });
      expect(updateCall.data.pickedUpAt).toBeInstanceOf(Date);
      expect(updateCall.data.planStartDate).toBeInstanceOf(Date);
      expect(updateCall.data.planEndDate).toBeInstanceOf(Date);

      const startMs = updateCall.data.planStartDate.getTime();
      const endMs = updateCall.data.planEndDate.getTime();
      expect(startMs).toBeGreaterThanOrEqual(before);
      expect(startMs).toBeLessThanOrEqual(after);

      // Exactly 7 days for WEEKLY
      const diffMs = endMs - startMs;
      expect(diffMs).toBeCloseTo(7 * 86400000, -3);
    });

    it('calculates plan window correctly for DAILY plan (1 day)', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_pickup_daily',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        currentPlan: 'Daily Commuter',
        currentPlanRef: dailyPlan,
      });
      m.db.vehicle.findUnique.mockResolvedValue({
        id: 'v_2',
        vehicleNumber: 'VF-002',
        status: 'AVAILABLE',
      });
      m.db.vehicle.updateMany.mockResolvedValue({ count: 1 });
      m.db.vehicle.update.mockResolvedValue({});
      m.db.rider.update.mockResolvedValue({ id: 'rider_pickup_daily', lifecycleStatus: 'ACTIVE' });

      await adminRiderUseCases.completePickup(
        'rider_pickup_daily',
        { vehicleId: 'v_2' },
        'admin_1',
        'SUPER_ADMIN'
      );

      const updateCall = m.db.rider.update.mock.calls[0][0];
      const diffMs = updateCall.data.planEndDate.getTime() - updateCall.data.planStartDate.getTime();
      expect(diffMs).toBeCloseTo(1 * 86400000, -3);
    });

    it('calculates plan window correctly for MONTHLY plan (30 days)', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_pickup_monthly',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        currentPlan: 'Monthly Pro',
        currentPlanRef: monthlyPlan,
      });
      m.db.vehicle.findUnique.mockResolvedValue({
        id: 'v_3',
        vehicleNumber: 'VF-003',
        status: 'AVAILABLE',
      });
      m.db.vehicle.updateMany.mockResolvedValue({ count: 1 });
      m.db.vehicle.update.mockResolvedValue({});
      m.db.rider.update.mockResolvedValue({ id: 'rider_pickup_monthly', lifecycleStatus: 'ACTIVE' });

      await adminRiderUseCases.completePickup(
        'rider_pickup_monthly',
        { vehicleId: 'v_3' },
        'admin_1',
        'SUPER_ADMIN'
      );

      const updateCall = m.db.rider.update.mock.calls[0][0];
      const diffMs = updateCall.data.planEndDate.getTime() - updateCall.data.planStartDate.getTime();
      expect(diffMs).toBeCloseTo(30 * 86400000, -3);
    });

    it('rejects pickup when the vehicle is not AVAILABLE/RESERVED (P1 guard)', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_pickup_maint',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        currentPlan: 'Weekly Saver',
        currentPlanRef: weeklyPlan,
      });
      m.db.vehicle.findUnique.mockResolvedValue({
        id: 'v_maint',
        vehicleNumber: 'VF-999',
        status: 'MAINTENANCE',
      });

      await expect(
        adminRiderUseCases.completePickup(
          'rider_pickup_maint',
          { vehicleId: 'v_maint' },
          'admin_1',
          'SUPER_ADMIN'
        )
      ).rejects.toThrow('not available for pickup');
      expect(m.db.vehicle.updateMany).not.toHaveBeenCalled();
    });

    it('resolves plan via currentPlanId if currentPlanRef was not populated', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_pickup_id',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        currentPlanId: 'plan_weekly',
        currentPlanRef: null,
      });
      m.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);
      m.db.rider.update.mockResolvedValue({ id: 'rider_pickup_id' });

      await adminRiderUseCases.completePickup(
        'rider_pickup_id',
        {},
        'admin_1',
        'SUPER_ADMIN'
      );

      expect(m.db.rentalPlan.findUnique).toHaveBeenCalledWith({ where: { id: 'plan_weekly' } });
      const updateCall = m.db.rider.update.mock.calls[0][0];
      const diffMs = updateCall.data.planEndDate.getTime() - updateCall.data.planStartDate.getTime();
      expect(diffMs).toBeCloseTo(7 * 86400000, -3);
    });

    it('falls back to 7 days if no plan can be resolved', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_pickup_noplan',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        currentPlanId: null,
        currentPlanRef: null,
        currentPlan: null,
      });
      m.db.rider.update.mockResolvedValue({ id: 'rider_pickup_noplan' });

      await adminRiderUseCases.completePickup(
        'rider_pickup_noplan',
        {},
        'admin_1',
        'SUPER_ADMIN'
      );

      const updateCall = m.db.rider.update.mock.calls[0][0];
      const diffMs = updateCall.data.planEndDate.getTime() - updateCall.data.planStartDate.getTime();
      expect(diffMs).toBeCloseTo(7 * 86400000, -3);
    });
  });

  describe('rentalRepository.startRental', () => {
    it('sets both planStartDate and planEndDate on activation', async () => {
      m.db.rider.findUnique.mockResolvedValue({
        id: 'rider_start_rental',
        lifecycleStatus: 'PICKUP_SCHEDULED',
        currentPlan: 'Weekly Saver',
        currentPlanId: 'plan_weekly',
      });
      m.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);
      m.db.rider.updateMany.mockResolvedValue({ count: 1 });

      const before = Date.now();
      await rentalRepository.startRental('rider_start_rental', 'v_1', 'hub_1', 'tl_1');

      expect(m.db.rider.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'rider_start_rental', lifecycleStatus: 'PICKUP_SCHEDULED' },
          data: expect.objectContaining({
            lifecycleStatus: 'ACTIVE',
            vehicleId: 'v_1',
            teamLeaderId: 'tl_1',
          }),
        })
      );

      const updateCall = m.db.rider.updateMany.mock.calls[0][0];
      expect(updateCall.data.planStartDate).toBeInstanceOf(Date);
      expect(updateCall.data.planEndDate).toBeInstanceOf(Date);

      const diffMs = updateCall.data.planEndDate.getTime() - updateCall.data.planStartDate.getTime();
      expect(diffMs).toBeCloseTo(7 * 86400000, -3);
    });
  });
});
