import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ensureActiveRentalLease, rentalUseCases } from '@/server/modules/rentals/rental.use-cases';

const m = vi.hoisted(() => {
  const db: any = {
    rentalPlan: {},
    hub: {},
    vehicle: {},
    rider: {},
    rentalLease: {},
    shift: {},
    systemSetting: {},
    teamLeader: {},
    $transaction: vi.fn(),
  };
  const tx: any = {
    vehicle: {},
    rentalLease: {},
    rider: {},
    shift: {},
    rentalPlan: {},
  };
  return {
    db,
    tx,
    createAuditLog: vi.fn(() => Promise.resolve()),
    invalidateCache: vi.fn(),
    getCachedRiderStatus: vi.fn(),
    getCachedRider: vi.fn(),
    invalidateRiderCache: vi.fn(),
    invalidateVehicleCache: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
  };
});

vi.mock('@/lib/db', () => ({ db: m.db }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: m.createAuditLog }));
vi.mock('@/lib/cache', () => ({
  getOrSetResponse: vi.fn(),
  invalidateCache: m.invalidateCache,
}));
vi.mock('@/lib/server-cache', () => ({
  getCachedRiderStatus: m.getCachedRiderStatus,
  getCachedRider: m.getCachedRider,
  invalidateRiderCache: m.invalidateRiderCache,
  invalidateVehicleCache: m.invalidateVehicleCache,
  CACHE_TTLS: { rider: 300, vehicle: 300 },
}));

describe('F-04: Active Path Rental Lease Creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ensureActiveRentalLease helper', () => {
    it('updates pre-existing BOOKED lease to ACTIVE without creating a new lease', async () => {
      const mockTx: any = {
        rentalLease: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findFirst: vi.fn(),
          create: vi.fn(),
        },
      };

      const rider = { id: 'rider_1', advanceRentPaid: true };
      const result = await ensureActiveRentalLease(mockTx, rider, 'vehicle_1');

      expect(mockTx.rentalLease.updateMany).toHaveBeenCalledWith({
        where: {
          riderId: 'rider_1',
          vehicleId: 'vehicle_1',
          status: { in: ['BOOKED', 'PICKUP_SCHEDULED'] },
        },
        data: expect.objectContaining({
          status: 'ACTIVE',
        }),
      });
      expect(mockTx.rentalLease.create).not.toHaveBeenCalled();
      expect(result).toEqual({ count: 1 });
    });

    it('returns existing ACTIVE lease if found (idempotent re-pickup)', async () => {
      const existingActiveLease = { id: 'lease_active_1', status: 'ACTIVE' };
      const mockTx: any = {
        rentalLease: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(existingActiveLease),
          create: vi.fn(),
        },
      };

      const rider = { id: 'rider_1', advanceRentPaid: false };
      const result = await ensureActiveRentalLease(mockTx, rider, 'vehicle_1');

      expect(mockTx.rentalLease.findFirst).toHaveBeenCalledWith({
        where: {
          riderId: 'rider_1',
          vehicleId: 'vehicle_1',
          status: 'ACTIVE',
        },
      });
      expect(mockTx.rentalLease.create).not.toHaveBeenCalled();
      expect(result).toBe(existingActiveLease);
    });

    it('creates new ACTIVE lease with nextRentDueAt advanced when advanceRentPaid is true', async () => {
      const mockTx: any = {
        rentalLease: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new_lease_1', ...data })),
        },
        shift: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'shift_1', startTime: '00:00', endTime: '23:59', isActive: true },
          ]),
        },
        rentalPlan: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'plan_weekly',
            type: 'WEEKLY',
            durationDays: 7,
            priceInPaise: 140000,
          }),
        },
      };

      const rider = {
        id: 'rider_1',
        advanceRentPaid: true,
        currentPlanId: 'plan_weekly',
      };

      const before = Date.now();
      const result = await ensureActiveRentalLease(mockTx, rider, 'vehicle_1');
      const after = Date.now();

      expect(mockTx.rentalLease.create).toHaveBeenCalled();
      const createdData = mockTx.rentalLease.create.mock.calls[0][0].data;

      expect(createdData.riderId).toBe('rider_1');
      expect(createdData.vehicleId).toBe('vehicle_1');
      expect(createdData.status).toBe('ACTIVE');
      expect(createdData.periodNo).toBe(1);
      expect(createdData.lastPaidAt).toBeInstanceOf(Date);
      expect(createdData.finalPriceInPaise).toBe(140000);

      // nextRentDueAt should be ~7 days in future
      const dueTime = createdData.nextRentDueAt.getTime();
      const expectedMin = before + 7 * 24 * 60 * 60 * 1000;
      const expectedMax = after + 7 * 24 * 60 * 60 * 1000;
      expect(dueTime).toBeGreaterThanOrEqual(expectedMin);
      expect(dueTime).toBeLessThanOrEqual(expectedMax);
      expect(result.id).toBe('new_lease_1');
    });

    it('creates new ACTIVE lease with nextRentDueAt set to now when advanceRentPaid is false', async () => {
      const mockTx: any = {
        rentalLease: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new_lease_2', ...data })),
        },
        shift: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'shift_daily', startTime: '06:00', endTime: '22:00', isActive: true },
          ]),
        },
      };

      const rider = {
        id: 'rider_2',
        advanceRentPaid: false,
        currentPlanRef: {
          id: 'plan_daily',
          type: 'DAILY',
          durationDays: 1,
          priceInPaise: 25000,
        },
      };

      const before = Date.now();
      await ensureActiveRentalLease(mockTx, rider, 'vehicle_2', { shiftId: 'shift_daily' });
      const after = Date.now();

      const createdData = mockTx.rentalLease.create.mock.calls[0][0].data;
      expect(createdData.periodNo).toBe(0);
      expect(createdData.lastPaidAt).toBeNull();
      expect(createdData.shiftId).toBe('shift_daily');
      expect(createdData.finalPriceInPaise).toBe(25000);

      const dueTime = createdData.nextRentDueAt.getTime();
      expect(dueTime).toBeGreaterThanOrEqual(before);
      expect(dueTime).toBeLessThanOrEqual(after);
    });

    it('calculates durationDays strictly from type if durationDays is absent', async () => {
      const mockTx: any = {
        rentalLease: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'new_lease_monthly', ...data })),
        },
        shift: {
          findMany: vi.fn().mockResolvedValue([]),
          findFirst: vi.fn().mockResolvedValue({ id: 'fallback_shift' }),
        },
      };

      const rider = {
        id: 'rider_3',
        advanceRentPaid: true,
        currentPlanRef: {
          id: 'plan_monthly',
          type: 'MONTHLY',
          priceInPaise: 500000,
        },
      };

      const before = Date.now();
      await ensureActiveRentalLease(mockTx, rider, 'vehicle_3');
      const after = Date.now();

      const createdData = mockTx.rentalLease.create.mock.calls[0][0].data;
      const dueTime = createdData.nextRentDueAt.getTime();
      const expectedMin = before + 30 * 24 * 60 * 60 * 1000;
      const expectedMax = after + 30 * 24 * 60 * 60 * 1000;
      expect(dueTime).toBeGreaterThanOrEqual(expectedMin);
      expect(dueTime).toBeLessThanOrEqual(expectedMax);
    });

    it('handles P2002 shift collision gracefully by creating dynamic shift', async () => {
      let createCallCount = 0;
      const mockTx: any = {
        rentalLease: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockImplementation(({ data }) => {
            createCallCount++;
            if (createCallCount === 1) {
              const err: any = new Error('Unique constraint failed on (vehicleId, shiftId, leaseDate)');
              err.code = 'P2002';
              throw err;
            }
            return Promise.resolve({ id: 'collided_lease_success', ...data });
          }),
        },
        shift: {
          findMany: vi.fn().mockResolvedValue([{ id: 'shift_conflict', startTime: '00:00', endTime: '23:59', isActive: true }]),
          create: vi.fn().mockResolvedValue({ id: 'dynamic_shift_unique' }),
        },
      };

      const rider = { id: 'rider_conflict', advanceRentPaid: false };
      const result = await ensureActiveRentalLease(mockTx, rider, 'vehicle_collision');

      expect(mockTx.shift.create).toHaveBeenCalled();
      expect(result.id).toBe('collided_lease_success');
      expect(result.shiftId).toBe('dynamic_shift_unique');
    });
  });

  describe('syncPickup integration with ensureActiveRentalLease', () => {
    it('creates RentalLease row when active-path rider picks up vehicle', async () => {
      const mockTx: any = {
        vehicle: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          update: vi.fn().mockResolvedValue({}),
        },
        rentalLease: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: 'active_path_lease', status: 'ACTIVE' }),
        },
        shift: {
          findMany: vi.fn().mockResolvedValue([
            { id: 'shift_1', startTime: '00:00', endTime: '23:59', isActive: true },
          ]),
        },
        rider: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          findUnique: vi.fn().mockResolvedValue({
            id: 'rider_active_path',
            lifecycleStatus: 'ACTIVE',
            assignedVehicle: 'VF-101',
            vehicleId: 'vehicle_101',
            pickupHub: 'Central Hub',
            advanceRentPaid: true,
            currentPlanRef: { durationDays: 1, priceInPaise: 50000 },
          }),
        },
      };

      m.db.$transaction = vi.fn().mockImplementation(async (cb) => cb(mockTx));
      m.db.rider.findUnique = vi.fn().mockResolvedValue({
        id: 'rider_active_path',
        lifecycleStatus: 'DEPOSIT_APPROVED',
        vehicleId: null,
        advanceRentPaid: true,
        currentPlanRef: { id: 'plan_1', type: 'DAILY', durationDays: 1, priceInPaise: 50000 },
      });
      m.db.vehicle.findFirst = vi.fn().mockResolvedValue({
        id: 'vehicle_101',
        vehicleNumber: 'VF-101',
        status: 'AVAILABLE',
        hub: { id: 'hub_1', name: 'Central Hub' },
      });

      const updatedRider = await rentalUseCases.syncPickup('rider_active_path', {
        vehicleId: 'vehicle_101',
      });

      expect(mockTx.rentalLease.create).toHaveBeenCalled();
      const leaseCreateData = mockTx.rentalLease.create.mock.calls[0][0].data;
      expect(leaseCreateData.riderId).toBe('rider_active_path');
      expect(leaseCreateData.vehicleId).toBe('vehicle_101');
      expect(leaseCreateData.status).toBe('ACTIVE');
      expect(updatedRider.lifecycleStatus).toBe('ACTIVE');
    });
  });
});
