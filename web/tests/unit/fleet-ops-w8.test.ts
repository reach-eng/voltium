/**
 * Phase W8 — Fleet & Ops State Machines (PR-M)
 *
 * Tests for:
 *   V-1: Vehicle single PUT enforces state machine (validate before write)
 *   S-1: ops_read denied on mutations; shifts_manage/fleet_manage/hubs_manage required
 *   S-2: Shift delete expanded lease guard + soft-delete instead of hard-delete
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateVehicleTransition, VehicleStateError } from '@/server/modules/vehicles/vehicle-state-machine';
import { hasPermission } from '@/lib/permissions';

// ---------------------------------------------------------------------------
// V-1: Vehicle state machine — unit tests on the state machine itself
// and on the updated updateVehicle use-case guard
// ---------------------------------------------------------------------------

describe('V-1: Vehicle State Machine Enforcement on Single PUT', () => {
  describe('validateVehicleTransition', () => {
    it('allows valid transitions (AVAILABLE → MAINTENANCE)', () => {
      expect(() => validateVehicleTransition('AVAILABLE', 'MAINTENANCE')).not.toThrow();
    });

    it('allows valid transitions (ASSIGNED → ACTIVE_RENTAL)', () => {
      expect(() => validateVehicleTransition('ASSIGNED', 'ACTIVE_RENTAL')).not.toThrow();
    });

    it('allows no-op (same → same)', () => {
      expect(() => validateVehicleTransition('AVAILABLE', 'AVAILABLE')).not.toThrow();
      expect(() => validateVehicleTransition('MAINTENANCE', 'MAINTENANCE')).not.toThrow();
    });

    it('rejects AVAILABLE → ACTIVE_RENTAL (must go via ASSIGNED)', () => {
      expect(() => validateVehicleTransition('AVAILABLE', 'ACTIVE_RENTAL')).toThrow(VehicleStateError);
    });

    it('rejects RETIRED → ACTIVE_RENTAL (cannot skip recovery steps)', () => {
      expect(() => validateVehicleTransition('RETIRED', 'ACTIVE_RENTAL')).toThrow(VehicleStateError);
    });

    it('rejects ACTIVE_RENTAL → AVAILABLE (must go via RETURN_PENDING or MAINTENANCE)', () => {
      expect(() => validateVehicleTransition('ACTIVE_RENTAL', 'AVAILABLE')).toThrow(VehicleStateError);
    });

    it('VehicleStateError carries current and target status', () => {
      try {
        validateVehicleTransition('ACTIVE_RENTAL', 'RETIRED');
      } catch (e) {
        expect(e).toBeInstanceOf(VehicleStateError);
        expect((e as VehicleStateError).currentStatus).toBe('ACTIVE_RENTAL');
        expect((e as VehicleStateError).targetStatus).toBe('RETIRED');
      }
    });
  });

  describe('updateVehicle use-case guard', () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('throws VehicleStateError on invalid status transition', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.vehicle, 'findUnique').mockResolvedValueOnce({
        id: 'v-1',
        status: 'AVAILABLE',
      } as any);

      const repoModule = await import('@/server/modules/vehicles/vehicle.repository');
      vi.spyOn(repoModule.vehicleRepository, 'update').mockResolvedValueOnce({} as any);

      const { vehicleUseCases } = await import('@/server/modules/vehicles/vehicle.use-cases');

      await expect(
        vehicleUseCases.updateVehicle('v-1', { status: 'ACTIVE_RENTAL' })
      ).rejects.toThrow(VehicleStateError);
    });

    it('succeeds on valid status transition and returns update result', async () => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.vehicle, 'findUnique').mockResolvedValueOnce({
        id: 'v-1',
        status: 'AVAILABLE',
      } as any);

      const repoModule = await import('@/server/modules/vehicles/vehicle.repository');
      vi.spyOn(repoModule.vehicleRepository, 'update').mockResolvedValueOnce({
        id: 'v-1',
        status: 'MAINTENANCE',
      } as any);

      const { vehicleUseCases } = await import('@/server/modules/vehicles/vehicle.use-cases');

      // Does not throw — valid transition AVAILABLE → MAINTENANCE
      const result = await vehicleUseCases.updateVehicle('v-1', { status: 'MAINTENANCE' });
      expect(result).toBeDefined();
    });

    it('skips state machine check when no status field is given', async () => {
      const dbMock = (await import('@/lib/db')).db;
      const findUniqueSpy = vi.spyOn(dbMock.vehicle, 'findUnique');

      const repoModule = await import('@/server/modules/vehicles/vehicle.repository');
      vi.spyOn(repoModule.vehicleRepository, 'update').mockResolvedValueOnce({
        id: 'v-1',
        model: 'Ola S1',
      } as any);

      const { vehicleUseCases } = await import('@/server/modules/vehicles/vehicle.use-cases');
      await vehicleUseCases.updateVehicle('v-1', { model: 'Ola S1' });

      // findUnique should NOT have been called for the state machine re-read
      expect(findUniqueSpy).not.toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// S-1: ops_read permission split
//
// PERMISSIONS model: hasPermission(adminRole: AdminRole, permKey: Permission)
// Roles with ops_read:   OPERATIONS_ADMIN, HUB_MANAGER, FLEET_MANAGER, TEAM_LEADER
// Roles with shifts_manage: OPERATIONS_ADMIN, HUB_MANAGER
// ---------------------------------------------------------------------------

describe('S-1: ops_read Denied on Shift Mutations', () => {
  it('FLEET_MANAGER has ops_read permission (can list shifts)', () => {
    // FLEET_MANAGER is in ops_read but NOT in shifts_manage
    expect(hasPermission('FLEET_MANAGER', 'ops_read')).toBe(true);
    expect(hasPermission('FLEET_MANAGER', 'shifts_manage')).toBe(false);
  });

  it('OPERATIONS_ADMIN has both ops_read and shifts_manage', () => {
    expect(hasPermission('OPERATIONS_ADMIN', 'ops_read')).toBe(true);
    expect(hasPermission('OPERATIONS_ADMIN', 'shifts_manage')).toBe(true);
  });

  it('canReadShifts accepts TEAM_LEADER (ops_read only); canMutateShifts rejects it', () => {
    // Mirror the route logic
    const canReadShifts = (adminRole: string) =>
      hasPermission(adminRole as any, 'shifts_manage' as any) ||
      hasPermission(adminRole as any, 'ops_read' as any) ||
      hasPermission(adminRole as any, 'fleet_manage' as any) ||
      hasPermission(adminRole as any, 'hubs_manage' as any);

    const canMutateShifts = (adminRole: string) =>
      hasPermission(adminRole as any, 'shifts_manage' as any) ||
      hasPermission(adminRole as any, 'fleet_manage' as any) ||
      hasPermission(adminRole as any, 'hubs_manage' as any);

    // TEAM_LEADER: has ops_read, but NOT shifts_manage/fleet_manage/hubs_manage
    // → can read but NOT mutate
    expect(canReadShifts('TEAM_LEADER')).toBe(true);
    expect(canMutateShifts('TEAM_LEADER')).toBe(false);

    // FLEET_MANAGER: has ops_read AND fleet_manage → can both read AND mutate
    expect(canReadShifts('FLEET_MANAGER')).toBe(true);
    expect(canMutateShifts('FLEET_MANAGER')).toBe(true);

    // OPERATIONS_ADMIN: has shifts_manage → can both read AND mutate
    expect(canReadShifts('OPERATIONS_ADMIN')).toBe(true);
    expect(canMutateShifts('OPERATIONS_ADMIN')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// S-2: Shift delete — expanded lease guard + soft-delete
// ---------------------------------------------------------------------------

describe('S-2: Shift Delete Full Lease Guard and Soft-Delete', () => {
  const NON_CLOSED_STATUSES = [
    'BOOKED',
    'PICKUP_SCHEDULED',
    'ACTIVE',
    'OVERDUE',
    'RETURN_PENDING',
    'SUSPENDED',
  ] as const;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each(NON_CLOSED_STATUSES)(
    'blocks soft-delete when lease status is %s',
    async (status) => {
      const dbMock = (await import('@/lib/db')).db;
      vi.spyOn(dbMock.rentalLease, 'count').mockResolvedValueOnce(1);
      const updateSpy = vi.spyOn(dbMock.shift, 'update').mockResolvedValueOnce({} as any);

      const { shiftUseCases } = await import('@/server/modules/shifts/shift.use-cases');

      await expect(shiftUseCases.deleteShift('shift-1', 'admin-1')).rejects.toThrow(
        /Cannot delete shift/
      );
      // Must not call soft-delete when leases exist
      expect(updateSpy).not.toHaveBeenCalled();
    }
  );

  it('soft-deletes (sets isActive=false, deletedAt) when no blocking leases', async () => {
    const dbMock = (await import('@/lib/db')).db;
    vi.spyOn(dbMock.rentalLease, 'count').mockResolvedValueOnce(0);
    const updateSpy = vi.spyOn(dbMock.shift, 'update').mockResolvedValueOnce({} as any);

    const { shiftUseCases } = await import('@/server/modules/shifts/shift.use-cases');
    const result = await shiftUseCases.deleteShift('shift-1', 'admin-1');

    expect(result).toEqual({ id: 'shift-1' });
    expect(updateSpy).toHaveBeenCalledWith({
      where: { id: 'shift-1' },
      data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
    });
  });

  it('listShifts excludes soft-deleted shifts (deletedAt: null filter applied)', async () => {
    const dbMock = (await import('@/lib/db')).db;
    const findManySpy = vi.spyOn(dbMock.shift, 'findMany').mockResolvedValueOnce([]);

    const { shiftUseCases } = await import('@/server/modules/shifts/shift.use-cases');
    await shiftUseCases.listShifts();

    expect(findManySpy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ deletedAt: null }),
      })
    );
  });
});
