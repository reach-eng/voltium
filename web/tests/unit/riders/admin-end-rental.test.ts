/**
 * F-10: End rental lifecycle transition unit tests
 *
 * Verifies that adminRiderUseCases.endRental:
 * 1. Transitions rider lifecycle status to CLOSED (from RETURN_PENDING, ACTIVE, SUSPENDED)
 * 2. Clears assigned vehicle and rental plan window on rider
 * 3. Sets assigned vehicle to AVAILABLE
 * 4. Closes active/return_pending rental leases
 * 5. Closes pending vehicle return records
 * 6. Invalidates rider, vehicle, and list caches
 * 7. Writes audit log
 * 8. Handles edge cases (already closed, non-existent, invalid transition, lookup fallback)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RiderLifecycleError } from '@/server/modules/riders/rider-lifecycle.service';

const mocks = vi.hoisted(() => ({
  findUniqueRider: vi.fn(),
  updateRider: vi.fn(),
  findFirstVehicle: vi.fn(),
  updateVehicle: vi.fn(),
  updateManyVehicle: vi.fn().mockResolvedValue({ count: 1 }),
  updateManyLease: vi.fn(),
  updateManyReturn: vi.fn(),
  createAuditLog: vi.fn(),
  transitionRiderStatus: vi.fn(),
  invalidateRiderCache: vi.fn(),
  invalidateVehicleCache: vi.fn(),
  invalidateCache: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: mocks.findUniqueRider,
      update: mocks.updateRider,
    },
    vehicle: {
      findFirst: mocks.findFirstVehicle,
      update: mocks.updateVehicle,
      updateMany: mocks.updateManyVehicle,
    },
    rentalLease: {
      updateMany: mocks.updateManyLease,
    },
    vehicleReturn: {
      updateMany: mocks.updateManyReturn,
    },
  },
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mocks.createAuditLog,
}));

vi.mock('@/server/modules/riders/rider-lifecycle.service', () => ({
  transitionRiderStatus: mocks.transitionRiderStatus,
  RiderLifecycleError: class RiderLifecycleError extends Error {
    constructor(
      message: string,
      public readonly currentStatus: string,
      public readonly targetStatus: string
    ) {
      super(message);
      this.name = 'RiderLifecycleError';
    }
  },
}));

vi.mock('@/lib/server-cache', () => ({
  getCachedRider: vi.fn(),
  getCachedRiderByPhone: vi.fn(),
  invalidateRiderCache: mocks.invalidateRiderCache,
  invalidateRiderPhoneCache: vi.fn(),
  invalidateVehicleCache: mocks.invalidateVehicleCache,
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('@/lib/logger', () => ({
  logger: mocks.logger,
}));

import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

describe('F-10: adminRiderUseCases.endRental', () => {
  const riderId = 'rider_cuid_123';
  const actorId = 'admin_cuid_456';

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUniqueRider.mockResolvedValue({
      id: riderId,
      riderId: 'RIDER-001',
      assignedVehicle: 'VH-101',
      vehicleId: 'veh_cuid_789',
      lifecycleStatus: 'RETURN_PENDING',
    });
    mocks.updateRider.mockResolvedValue({
      id: riderId,
      assignedVehicle: null,
      lifecycleStatus: 'CLOSED',
    });
    mocks.updateVehicle.mockResolvedValue({ id: 'veh_cuid_789' });
    mocks.updateManyLease.mockResolvedValue({ count: 1 });
    mocks.updateManyReturn.mockResolvedValue({ count: 1 });
    mocks.transitionRiderStatus.mockResolvedValue({ id: riderId, lifecycleStatus: 'CLOSED' });
    mocks.createAuditLog.mockResolvedValue({});
  });

  it('successfully ends rental from RETURN_PENDING to CLOSED with full teardown', async () => {
    const result = await adminRiderUseCases.endRental(riderId, actorId);

    // 1. Rider status transition to CLOSED
    expect(mocks.transitionRiderStatus).toHaveBeenCalledWith(riderId, 'CLOSED');

    // 2. Rider vehicle and plan fields cleared
    expect(mocks.updateRider).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: riderId },
        data: {
          assignedVehicle: null,
          vehicleId: null,
          pickedUpAt: null,
          planStartDate: null,
          planEndDate: null,
        },
      })
    );

    // 3. Vehicle marked AVAILABLE via atomic updateMany claim (P1)
    expect(mocks.updateManyVehicle).toHaveBeenCalledWith({
      where: { id: 'veh_cuid_789' },
      data: {
        status: 'AVAILABLE',
        assignedAt: null,
        currentRiderId: null,
      },
    });

    // 4. Open rental leases closed
    expect(mocks.updateManyLease).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          riderId,
          status: { in: ['ACTIVE', 'RETURN_PENDING', 'PICKUP_SCHEDULED', 'OVERDUE'] },
        },
        data: expect.objectContaining({
          status: 'CLOSED',
        }),
      })
    );

    // 5. Open vehicle returns closed
    expect(mocks.updateManyReturn).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          riderId,
          status: { in: ['SUBMITTED', 'INSPECTION_PENDING'] },
        },
        data: expect.objectContaining({
          status: 'CLOSED',
          inspectedBy: actorId,
        }),
      })
    );

    // 6. Caches invalidated
    expect(mocks.invalidateRiderCache).toHaveBeenCalledWith(riderId);
    expect(mocks.invalidateVehicleCache).toHaveBeenCalledWith('veh_cuid_789');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('vehicles_list:*');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:vehicles:*');
    expect(mocks.invalidateCache).toHaveBeenCalledWith('admin:rentals:*');

    // 7. Audit log recorded
    expect(mocks.createAuditLog).toHaveBeenCalledWith({
      actorId,
      action: 'rider.end_rental',
      entity: 'Rider',
      entityId: riderId,
      details: {
        previousVehicle: 'VH-101',
        previousStatus: 'RETURN_PENDING',
        newStatus: 'CLOSED',
      },
    });

    expect(result.assignedVehicle).toBeNull();
  });

  it('supports direct closure from ACTIVE to CLOSED', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: riderId,
      riderId: 'RIDER-001',
      assignedVehicle: 'VH-101',
      vehicleId: 'veh_cuid_789',
      lifecycleStatus: 'ACTIVE',
    });

    await adminRiderUseCases.endRental(riderId, actorId);

    expect(mocks.transitionRiderStatus).toHaveBeenCalledWith(riderId, 'CLOSED');
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          previousStatus: 'ACTIVE',
          newStatus: 'CLOSED',
        }),
      })
    );
  });

  it('supports closure from SUSPENDED to CLOSED', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: riderId,
      riderId: 'RIDER-001',
      assignedVehicle: 'VH-101',
      vehicleId: 'veh_cuid_789',
      lifecycleStatus: 'SUSPENDED',
    });

    await adminRiderUseCases.endRental(riderId, actorId);

    expect(mocks.transitionRiderStatus).toHaveBeenCalledWith(riderId, 'CLOSED');
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          previousStatus: 'SUSPENDED',
          newStatus: 'CLOSED',
        }),
      })
    );
  });

  it('is a no-op for lifecycle transition if rider is already CLOSED', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: riderId,
      riderId: 'RIDER-001',
      assignedVehicle: null,
      vehicleId: null,
      lifecycleStatus: 'CLOSED',
    });

    await adminRiderUseCases.endRental(riderId, actorId);

    expect(mocks.transitionRiderStatus).not.toHaveBeenCalled();
    expect(mocks.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({
          previousStatus: 'CLOSED',
          newStatus: 'CLOSED',
        }),
      })
    );
  });

  it('falls back to finding vehicle by vehicleNumber or vehicleId when vehicleId is not linked on rider', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: riderId,
      riderId: 'RIDER-001',
      assignedVehicle: 'MH-02-CD-5678',
      vehicleId: null,
      lifecycleStatus: 'ACTIVE',
    });

    mocks.findFirstVehicle.mockResolvedValue({
      id: 'veh_fallback_cuid',
    });

    await adminRiderUseCases.endRental(riderId, actorId);

    expect(mocks.findFirstVehicle).toHaveBeenCalledWith({
      where: {
        OR: [
          { vehicleId: 'MH-02-CD-5678' },
          { vehicleNumber: 'MH-02-CD-5678' },
        ],
      },
      select: { id: true },
    });

    expect(mocks.updateManyVehicle).toHaveBeenCalledWith({
      where: { id: 'veh_fallback_cuid' },
      data: {
        status: 'AVAILABLE',
        assignedAt: null,
        currentRiderId: null,
      },
    });
    expect(mocks.invalidateVehicleCache).toHaveBeenCalledWith('veh_fallback_cuid');
  });

  it('throws an error if rider is not found', async () => {
    mocks.findUniqueRider.mockResolvedValue(null);

    await expect(adminRiderUseCases.endRental('unknown_id', actorId)).rejects.toThrow(
      'Rider not found: unknown_id'
    );
  });

  it('propagates RiderLifecycleError when lifecycle transition is forbidden', async () => {
    mocks.findUniqueRider.mockResolvedValue({
      id: riderId,
      riderId: 'RIDER-001',
      assignedVehicle: null,
      vehicleId: null,
      lifecycleStatus: 'NEW',
    });

    mocks.transitionRiderStatus.mockRejectedValue(
      new RiderLifecycleError('Invalid transition from NEW to CLOSED', 'NEW', 'CLOSED')
    );

    await expect(adminRiderUseCases.endRental(riderId, actorId)).rejects.toThrow(
      RiderLifecycleError
    );
  });

  it('aborts BEFORE closing the rider when fleet teardown fails (P1: no silent fleet leak)', async () => {
    // P1: the old non-blocking teardown closed the rider while the vehicle
    // stayed ACTIVE_RENTAL / leases stayed ACTIVE (invisible fleet leak).
    // Fleet/lease/return closures now throw before the CLOSED transition,
    // leaving the rider retry-safe.
    mocks.updateManyVehicle.mockRejectedValueOnce(new Error('DB vehicle lock timeout'));

    await expect(adminRiderUseCases.endRental(riderId, actorId)).rejects.toThrow(
      'Failed to release vehicle to AVAILABLE; endRental aborted before closing rider'
    );
    // Rider was NOT closed and caches were NOT invalidated for a close.
    expect(mocks.transitionRiderStatus).not.toHaveBeenCalledWith(
      riderId,
      expect.stringContaining('CLOSED')
    );
    expect(mocks.logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[endRental] Vehicle update to AVAILABLE failed'),
      expect.any(Object)
    );
  });

  it('aborts BEFORE closing the rider when lease closure fails (P1)', async () => {
    mocks.updateManyVehicle.mockResolvedValueOnce({ count: 1 });
    mocks.updateManyLease.mockRejectedValueOnce(new Error('DB lease error'));

    await expect(adminRiderUseCases.endRental(riderId, actorId)).rejects.toThrow(
      'Failed to close rental leases; endRental aborted before closing rider'
    );
    expect(mocks.transitionRiderStatus).not.toHaveBeenCalledWith(
      riderId,
      expect.stringContaining('CLOSED')
    );
  });
});
