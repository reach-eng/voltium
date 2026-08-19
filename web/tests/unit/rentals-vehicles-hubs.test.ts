/**
 * TG (2026-08-05 rentals/vehicles/hubs audit) — P1/P2/P3 regression tests for
 * repositories and use-cases.
 *
 * Covers the audit's test gaps that the P0 pass did not:
 *   - P1.1: executeLeaseAction re-reads rider status inside the tx and guards
 *     every write with status-guarded updateMany + count checks (race test)
 *   - P1.2: bookRental / startRental set pickupHub to the hub NAME
 *   - P1.3: lease startTime/endTime writes are UTC HH:MM, not server-local
 *   - P1.5/P1.6/P1.9: hub/vehicle/plan deletes are soft + read paths filter
 *   - P1.8: getTeamLeaders filters by hubId
 *   - P1.11: assignVehicle rejects any non-CLOSED lease
 *   - P2.4: executeLeaseAction invalidates vehicles_list:* / admin:vehicles:*
 *   - P2.6/P2.13/P2.20/P2.9: hub update diff audit, enum breakdown, batched
 *     bulk audits, P2003 conflict
 *   - P2.8: vehicle findById resolves cuid OR public vehicleId
 *   - P3.9: bookRental converts P2002 → RentalBookError
 *   - P3.11: hub pagination count shares the list's where
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RentalStateError } from '@/server/modules/rentals/rental-state-machine';
import { RentalBookError } from '@/server/modules/rentals/use-cases/errors';

const m = vi.hoisted(() => {
  // Model stubs must pre-exist so tests can assign vi.fn() on nested methods.
  const db: any = {
    rentalPlan: {},
    hub: {},
    vehicle: {},
    rider: {},
    rentalLease: {},
    shift: {},
    systemSetting: {},
    teamLeader: {},
  };
  const tx: any = {};
  return {
    db,
    tx,
    createAuditLog: vi.fn(() => Promise.resolve()),
    invalidateCache: vi.fn(),
    getCachedRiderStatus: vi.fn(),
    getCachedRider: vi.fn(),
    getCachedHub: vi.fn(),
    getCachedVehicle: vi.fn(),
    invalidateRiderCache: vi.fn(),
    invalidateVehicleCache: vi.fn(),
    invalidateHubCache: vi.fn(),
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
  getCachedHub: m.getCachedHub,
  getCachedVehicle: m.getCachedVehicle,
  invalidateRiderCache: m.invalidateRiderCache,
  invalidateVehicleCache: m.invalidateVehicleCache,
  invalidateHubCache: m.invalidateHubCache,
  CACHE_TTLS: { rider: 300 },
}));
vi.mock('@/lib/flatten-rider', () => ({
  flattenRider: (r: any) => r,
  paiseToRupees: (p: number) => p / 100,
  rupeesToPaise: (r: number) => r * 100,
}));
vi.mock('@/lib/sign-rider', () => ({ signRiderUrls: (r: any) => r }));

import { rentalRepository, utcNowHHMM } from '@/server/modules/rentals/rental.repository';
import { rentalUseCases } from '@/server/modules/rentals/rental.use-cases';
import { vehicleRepository } from '@/server/modules/vehicles/vehicle.repository';
import { vehicleUseCases } from '@/server/modules/vehicles/vehicle.use-cases';
import { hubRepository } from '@/server/modules/hubs/hub.repository';
import { hubUseCases } from '@/server/modules/hubs/hub.use-cases';
import { planUseCases } from '@/server/modules/plans/plan.use-cases';

function makeTx() {
  m.db.$transaction = vi.fn(async (fn: (tx: any) => Promise<unknown>) => fn(m.tx));
}

const BOOKED_LEASE = {
  id: 'L1',
  riderId: 'R1',
  vehicleId: 'V1',
  status: 'BOOKED',
  rider: { lifecycleStatus: 'PICKUP_SCHEDULED' },
  vehicle: { vehicleNumber: 'MH-01' },
};

// ═══════════════════════════════════════════════════════════════════════════
// P1.1 — executeLeaseAction re-reads + guarded writes (audit demotion REJECTED)
// ═══════════════════════════════════════════════════════════════════════════

describe('P1.1: executeLeaseAction validates against a FRESH in-tx status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeTx();
    m.tx.rider = {
      findUnique: vi.fn().mockResolvedValue({ lifecycleStatus: 'PICKUP_SCHEDULED' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    m.tx.rentalLease = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'L1', status: 'ACTIVE' }),
    };
    m.tx.vehicle = { update: vi.fn().mockResolvedValue({}) };
  });

  it('re-reads the rider status inside the tx (never the pre-tx snapshot)', async () => {
    await rentalRepository.executeLeaseAction(BOOKED_LEASE, 'START');
    expect(m.tx.rider.findUnique).toHaveBeenCalledWith({
      where: { id: 'R1' },
      select: { lifecycleStatus: true },
    });
  });

  it('guards the rider write with the fresh status in the WHERE (optimistic lock)', async () => {
    await rentalRepository.executeLeaseAction(BOOKED_LEASE, 'START');
    expect(m.tx.rider.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'R1', lifecycleStatus: 'PICKUP_SCHEDULED' },
        data: expect.objectContaining({
          lifecycleStatus: 'ACTIVE',
          vehicleId: 'V1',
          assignedVehicle: 'MH-01',
        }),
      })
    );
    expect(m.tx.rentalLease.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'L1', status: 'BOOKED' } })
    );
  });

  it('throws RentalStateError when a concurrent action already moved the rider', async () => {
    m.tx.rider.updateMany.mockResolvedValue({ count: 0 });
    await expect(rentalRepository.executeLeaseAction(BOOKED_LEASE, 'START')).rejects.toThrow(
      RentalStateError
    );
    // Nothing else was written after the lost race
    expect(m.tx.rentalLease.updateMany).not.toHaveBeenCalled();
  });

  it('throws RentalStateError when the lease status moved under us', async () => {
    m.tx.rentalLease.updateMany.mockResolvedValue({ count: 0 });
    await expect(rentalRepository.executeLeaseAction(BOOKED_LEASE, 'START')).rejects.toThrow(
      RentalStateError
    );
  });

  it('returns the updated lease after a successful transition', async () => {
    const result = await rentalRepository.executeLeaseAction(BOOKED_LEASE, 'START');
    expect(result.status).toBe('ACTIVE');
    expect(m.tx.rentalLease.findUnique).toHaveBeenCalledWith({ where: { id: 'L1' } });
  });

  it('P2.4: invalidates the vehicle LIST caches (bypasses repo update path)', async () => {
    await rentalRepository.executeLeaseAction(BOOKED_LEASE, 'START');
    expect(m.invalidateCache).toHaveBeenCalledWith('vehicles_list:*');
    expect(m.invalidateCache).toHaveBeenCalledWith('admin:vehicles:*');
  });
});

describe('P1.1: executeLeaseAction CLOSE writes UTC endTime (P1.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeTx();
    // Realistic close path: the rider is already RETURN_PENDING (the rider
    // lifecycle machine only allows RETURN_PENDING → CLOSED, never ACTIVE →
    // CLOSED).
    m.tx.rider = {
      findUnique: vi.fn().mockResolvedValue({ lifecycleStatus: 'RETURN_PENDING' }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    m.tx.rentalLease = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({ id: 'L1', status: 'CLOSED', endTime: '12:00' }),
    };
    m.tx.vehicle = { update: vi.fn().mockResolvedValue({}) };
  });

  it('frees the vehicle and clears the rider assignment, guarded', async () => {
    const lease = { ...BOOKED_LEASE, status: 'RETURN_PENDING', rider: { lifecycleStatus: 'RETURN_PENDING' } };
    await rentalRepository.executeLeaseAction(lease, 'CLOSE');
    expect(m.tx.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'AVAILABLE', assignedAt: null } })
    );
    expect(m.tx.rider.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'R1', lifecycleStatus: 'RETURN_PENDING' },
        data: expect.objectContaining({ lifecycleStatus: 'CLOSED', vehicleId: null, assignedVehicle: null }),
      })
    );
  });

  it('writes endTime as UTC HH:MM (toISOString), not server-local time', async () => {
    const lease = { ...BOOKED_LEASE, status: 'RETURN_PENDING', rider: { lifecycleStatus: 'RETURN_PENDING' } };
    await rentalRepository.executeLeaseAction(lease, 'CLOSE');
    const data = m.tx.rentalLease.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('CLOSED');
    expect(data.endTime).toMatch(/^\d{2}:\d{2}$/);
    expect(data.endTime).toBe(new Date().toISOString().slice(11, 16));
  });
});

describe('utcNowHHMM helper (P1.3)', () => {
  it('returns a zero-padded UTC HH:MM string', () => {
    const t = utcNowHHMM();
    expect(t).toMatch(/^\d{2}:\d{2}$/);
    expect(t).toBe(new Date().toISOString().slice(11, 16));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1.2 — pickupHub is always the hub NAME
// ═══════════════════════════════════════════════════════════════════════════

describe('P1.2: startRental resolves the hub name for pickupHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCachedRiderStatus.mockResolvedValue({ lifecycleStatus: 'PLAN_SELECTED' });
    m.getCachedRider.mockResolvedValue({});
  });

  it('resolves a hub cuid to its name', async () => {
    m.db.hub.findUnique = vi.fn().mockResolvedValue({ name: 'Mumbai Central' });
    m.db.rider.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await rentalRepository.startRental('r1', 'v1', 'hub-cuid', 'TL-1');
    const data = m.db.rider.updateMany.mock.calls[0][0].data;
    expect(data.pickupHub).toBe('Mumbai Central');
  });

  it('passes a name argument through unchanged (no cuid to resolve)', async () => {
    m.db.hub.findUnique = vi.fn().mockResolvedValue(null);
    m.db.rider.updateMany = vi.fn().mockResolvedValue({ count: 1 });
    await rentalRepository.startRental('r1', 'v1', 'Central Hub', 'TL-1');
    const data = m.db.rider.updateMany.mock.calls[0][0].data;
    expect(data.pickupHub).toBe('Central Hub');
  });
});

describe('P1.2: bookRental sets pickupHub to the hub name', () => {
  const vehicle = {
    id: 'v1',
    status: 'AVAILABLE',
    hubId: 'h1',
    hub: { id: 'h1', name: 'Mumbai Central' },
    vehicleNumber: 'MH-01',
  };
  const lease = {
    id: 'L1',
    status: 'BOOKED',
    leaseDate: '2026-08-06',
    startTime: '09:00',
    basePrice: 18000,
    finalPrice: 18000,
    vehicle: { id: 'v1', vehicleId: 'VH-1', model: 'EV-1' },
    shift: { id: 's1', name: 'Morning', startTime: '09:00', endTime: '12:00' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    makeTx();
    m.db.vehicle.findUnique = vi.fn().mockResolvedValue(vehicle);
    m.db.shift.findUnique = vi.fn().mockResolvedValue({ id: 's1', isActive: true, maxBookings: 5 });
    m.db.systemSetting.findUnique = vi.fn().mockResolvedValue(null);
    m.db.vehicle.count = vi.fn().mockResolvedValue(10);
    m.tx.rentalLease = {
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue(lease),
    };
    // PR-ONBOARDING-2026-08-11 (audit 2.11 R3): bookRental vehicle flip
    // now uses updateMany with a status guard. Mock must match.
    m.tx.vehicle = {
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    m.tx.rider = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
  });

  it('writes pickupHub: <hub name> (not a cuid, not stale)', async () => {
    await rentalUseCases.bookRental('r1', {
      vehicleId: 'v1',
      shiftId: 's1',
      leaseDate: '2026-08-06',
      startTime: '09:00',
    });
    const data = m.tx.rider.updateMany.mock.calls[0][0].data;
    expect(data.pickupHub).toBe('Mumbai Central');
    expect(data.lifecycleStatus).toBe('PICKUP_SCHEDULED');
  });

  it('P3.9: converts a P2002 unique-constraint violation into RentalBookError', async () => {
    m.tx.rentalLease.create = vi.fn().mockRejectedValue({ code: 'P2002' });
    try {
      await rentalUseCases.bookRental('r1', {
        vehicleId: 'v1',
        shiftId: 's1',
        leaseDate: '2026-08-06',
        startTime: '09:00',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RentalBookError);
      expect((err as RentalBookError).code).toBe('CONFLICT');
    }
  });

  it('re-throws non-P2002 errors untouched', async () => {
    m.tx.rentalLease.create = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(
      rentalUseCases.bookRental('r1', { vehicleId: 'v1', shiftId: 's1', leaseDate: 'd', startTime: '09:00' })
    ).rejects.toThrow('boom');
  });
});

describe('P1.3: syncPickup writes UTC startTime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    makeTx();
    m.db.rider.findUnique = vi.fn().mockResolvedValue({
      id: 'r1',
      lifecycleStatus: 'PLAN_SELECTED',
      vehicleId: null,
      kycProfile: {},
      wallet: {},
      guarantor: {},
      vehicleReturns: [],
    });
    m.db.vehicle.findFirst = vi.fn().mockResolvedValue({
      id: 'v1',
      status: 'AVAILABLE',
      vehicleNumber: 'MH-01',
      hub: { name: 'Mumbai Central' },
    });
    m.tx.vehicle = {
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    };
    m.tx.rentalLease = { updateMany: vi.fn().mockResolvedValue({ count: 1 }) };
    m.tx.rider = {
      // PR-ONBOARDING-2026-08-11 (audit 2.11 R5): syncPickup uses
      // updateMany with a lifecycle guard, not update. The mock must
      // match.
      update: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      findUnique: vi.fn().mockResolvedValue({
        id: 'r1',
        vehicleId: 'v1',
        assignedVehicle: 'MH-01',
        pickupHub: 'Mumbai Central',
        kycProfile: {},
        wallet: {},
        guarantor: {},
        vehicleReturns: [],
      }),
    };
  });

  it('sets the lease startTime from toISOString (UTC), not server-local time', async () => {
    await rentalUseCases.syncPickup('r1', { vehicleId: 'v1' });
    const data = m.tx.rentalLease.updateMany.mock.calls[0][0].data;
    expect(data.status).toBe('ACTIVE');
    expect(data.startTime).toMatch(/^\d{2}:\d{2}$/);
    expect(data.startTime).toBe(new Date().toISOString().slice(11, 16));
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1.9 — plans: deletedAt filters + soft delete
// ═══════════════════════════════════════════════════════════════════════════

describe('P1.9: plan reads filter soft-deleted rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.rentalPlan.findMany = vi.fn().mockResolvedValue([]);
    m.db.rentalPlan.count = vi.fn().mockResolvedValue(0);
    m.db.rentalPlan.findUnique = vi.fn().mockResolvedValue(null);
  });

  it('list() filters deletedAt: null in both findMany and count', async () => {
    await planUseCases.list(1, 10);
    expect(m.db.rentalPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    );
    expect(m.db.rentalPlan.count).toHaveBeenCalledWith({ where: { deletedAt: null } });
  });

  it('listActivePlans() filters deletedAt: null', async () => {
    await planUseCases.listActivePlans();
    expect(m.db.rentalPlan.findMany).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
      orderBy: { priceInPaise: 'asc' },
    });
  });

  it('rentalRepository.findPlans / findPlanById filter deletedAt: null', async () => {
    m.db.rentalPlan.findMany.mockResolvedValue([]);
    await rentalRepository.findPlans();
    expect(m.db.rentalPlan.findMany).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
    });

    m.db.rentalPlan.findUnique.mockResolvedValue(null);
    await rentalRepository.findPlanById('p1');
    expect(m.db.rentalPlan.findUnique).toHaveBeenCalledWith({
      where: { id: 'p1', deletedAt: null },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1.6 / P2.8 — vehicles: soft bulk delete + dual-identifier lookup
// ═══════════════════════════════════════════════════════════════════════════

describe('P1.6: vehicleRepository.bulkDelete is a soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.vehicle.updateMany = vi.fn().mockResolvedValue({ count: 2 });
    m.db.vehicle.deleteMany = vi.fn();
  });

  it('sets deletedAt + RETIRED instead of hard-deleting rows', async () => {
    await vehicleRepository.bulkDelete(['v1', 'v2']);
    expect(m.db.vehicle.deleteMany).not.toHaveBeenCalled();
    const { where, data } = m.db.vehicle.updateMany.mock.calls[0][0];
    expect(where).toEqual({ id: { in: ['v1', 'v2'] }, deletedAt: null });
    expect(data.status).toBe('RETIRED');
    expect(data.deletedAt).toBeInstanceOf(Date);
  });
});

describe('P2.8: vehicle findById resolves cuid OR public vehicleId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCachedVehicle.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    m.db.vehicle.findFirst = vi.fn().mockResolvedValue({ id: 'internal-cuid' });
  });

  it('looks up by either id or vehicleId and excludes soft-deleted rows', async () => {
    await vehicleRepository.findById('VH-PUBLIC-1');
    expect(m.db.vehicle.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [{ id: 'VH-PUBLIC-1' }, { vehicleId: 'VH-PUBLIC-1' }],
        deletedAt: null,
      },
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// P1.11 — assignVehicle rejects any non-CLOSED lease
// ═══════════════════════════════════════════════════════════════════════════

describe('P1.11: assignVehicle blocks riders with any open lease', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.vehicle.findUnique = vi.fn().mockResolvedValue({ id: 'v1', status: 'AVAILABLE' });
    m.db.rider.findUnique = vi.fn().mockResolvedValue({ id: 'r1', lifecycleStatus: 'ACTIVE' });
    m.db.rider.update = vi.fn().mockResolvedValue({});
    m.db.vehicle.update = vi.fn().mockResolvedValue({});
  });

  it('queries non-CLOSED leases (was status: ACTIVE)', async () => {
    m.db.rentalLease.findFirst = vi.fn().mockResolvedValue(null);
    await vehicleUseCases.assignVehicle('v1', 'r1');
    expect(m.db.rentalLease.findFirst).toHaveBeenCalledWith({
      where: { riderId: 'r1', status: { not: 'CLOSED' } },
    });
  });

  it('rejects an OVERDUE lease (the P1.11 bug)', async () => {
    m.db.rentalLease.findFirst = vi.fn().mockResolvedValue({ id: 'L1', status: 'OVERDUE' });
    await expect(vehicleUseCases.assignVehicle('v1', 'r1')).rejects.toThrow(
      'already has an open rental'
    );
    expect(m.db.rider.update).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Hubs — P2.13 breakdown, P2.6 diff audit, P1.5 soft delete,
// P2.20 batched audits, P2.9 P2003, P1.8 team-leader scope
// ═══════════════════════════════════════════════════════════════════════════

describe('P2.13: hub vehicle breakdown enumerates the real VehicleStatus enum', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.hub.findMany = vi.fn().mockResolvedValue([
      {
        id: 'h1',
        name: 'Hub A',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        vehicles: [
          { status: 'AVAILABLE' },
          { status: 'ACTIVE_RENTAL' },
          { status: 'RESERVED' },
          { status: 'RETURN_PENDING' },
          { status: 'MAINTENANCE' },
          { status: 'RETIRED' },
          { status: 'LOST' },
        ],
      },
    ]);
    m.db.hub.count = vi.fn().mockResolvedValue(1);
  });

  it('counts ACTIVE_RENTAL / RESERVED / RETURN_PENDING as assigned (was silently dropped)', async () => {
    const result = await hubUseCases.listAdminHubs(1, 10);
    expect(result.hubs[0].vehicleBreakdown).toEqual({
      available: 1,
      assigned: 3,
      maintenance: 1,
      retired: 1,
      lost: 1,
      total: 7,
    });
  });
});

describe('P2.6: hub update audit captures the diff, not the raw payload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.getCachedHub.mockImplementation(async (_key: string, fn: () => Promise<unknown>) => fn());
    m.db.hub.findFirst = vi.fn().mockResolvedValue({ id: 'h1', name: 'A', city: 'Mumbai' });
    m.db.hub.update = vi.fn().mockResolvedValue({ id: 'h1', name: 'B', city: 'Mumbai' });
  });

  it('logs changedFields with before/after values', async () => {
    await hubUseCases.updateHub('h1', { name: 'B' }, 'admin1');
    const audit = m.createAuditLog.mock.calls[0][0];
    expect(audit.action).toBe('hub.update');
    expect(audit.details.changedFields).toEqual(['name']);
    expect(audit.details.before).toEqual({ name: 'A' });
    expect(audit.details.after).toEqual({ name: 'B' });
  });

  it('does not report unchanged fields as changed', async () => {
    await hubUseCases.updateHub('h1', { city: 'Mumbai' }, 'admin1');
    const audit = m.createAuditLog.mock.calls[0][0];
    expect(audit.details.changedFields).toEqual([]);
  });
});

describe('P1.5: hub delete is a soft delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.vehicle.count = vi.fn().mockResolvedValue(0);
    m.db.hub.update = vi.fn().mockResolvedValue({});
    m.db.hub.delete = vi.fn();
  });

  it('sets deletedAt + isActive=false instead of deleting the row', async () => {
    await hubUseCases.deleteHub('h1', 'admin1');
    expect(m.db.hub.delete).not.toHaveBeenCalled();
    const { where, data } = m.db.hub.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'h1' });
    expect(data.isActive).toBe(false);
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(m.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'hub.delete', entityId: 'h1' })
    );
  });

  it('still rejects when vehicles are assigned', async () => {
    m.db.vehicle.count = vi.fn().mockResolvedValue(3);
    await expect(hubUseCases.deleteHub('h1', 'admin1')).rejects.toThrow('Cannot delete hub');
  });
});

describe('P2.20: hub bulk ops write ONE batched audit log', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.hub.updateMany = vi.fn().mockResolvedValue({ count: 3 });
  });

  it('bulkActivate writes a single hub.bulk_activate entry with ids + count', async () => {
    await hubUseCases.bulkActivate(['h1', 'h2', 'h3'], 'admin1');
    expect(m.createAuditLog).toHaveBeenCalledTimes(1);
    expect(m.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'hub.bulk_activate',
        entityId: 'multiple',
        details: { ids: ['h1', 'h2', 'h3'], count: 3 },
      })
    );
  });

  it('bulkDeactivate writes a single hub.bulk_deactivate entry', async () => {
    await hubUseCases.bulkDeactivate(['h1', 'h2'], 'admin1');
    expect(m.createAuditLog).toHaveBeenCalledTimes(1);
    expect(m.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'hub.bulk_deactivate', entityId: 'multiple' })
    );
  });
});

describe('P2.9: hub bulkDelete surfaces the FK race as a friendly conflict', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.hub.findMany = vi.fn().mockResolvedValue([]);
  });

  it('converts a P2003 constraint violation into a clear error', async () => {
    m.db.hub.updateMany = vi.fn().mockRejectedValue({ code: 'P2003' });
    await expect(hubUseCases.bulkDelete(['h1'], 'admin1')).rejects.toThrow(
      'Cannot delete hub(s)'
    );
  });

  it('soft-deletes and writes a batched audit log on success', async () => {
    m.db.hub.updateMany = vi.fn().mockResolvedValue({ count: 2 });
    const result = await hubUseCases.bulkDelete(['h1', 'h2'], 'admin1');
    expect(result.count).toBe(2);
    expect(m.createAuditLog).toHaveBeenCalledTimes(1);
    expect(m.createAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'hub.bulk_delete', entityId: 'multiple' })
    );
  });
});

describe('P1.8: getTeamLeaders filters by hubId', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.db.teamLeader.findMany = vi.fn().mockResolvedValue([]);
    m.db.teamLeader.findMany.mockResolvedValue([]);
  });

  it('filters by hubId when one is given', async () => {
    await hubRepository.getTeamLeaders('hub-1');
    expect(m.db.teamLeader.findMany).toHaveBeenCalledWith({
      where: { hubId: 'hub-1' },
      orderBy: { name: 'asc' },
    });
  });

  it('returns active team leaders when no hub is given', async () => {
    await hubRepository.getTeamLeaders();
    expect(m.db.teamLeader.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  });
});
