/**
 * Incidents audit (2026-09-08) — use-case layer regression tests.
 *
 *   - P0-1: list formatter returns photos + timeline (the dialog crashed on
 *           undefined.photos.length; the report crashed on undefined.map).
 *   - P1-1: create persists insuranceClaim + insuranceClaimNumber.
 *   - P1-2: updateIncident writes assignedToId (validated) + resolvedById.
 *   - P1-5: create's vehicle→MAINTENANCE flip is guarded (AVAILABLE/ASSIGNED
 *           only) and runs inside the create transaction.
 *   - P2-4: incidentId P2002 retries instead of 500ing.
 *   - P2-7: create/resolve emit NOTIFICATION_SEND outbox events.
 *   - P2-8: rider.phone search is case-insensitive.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { incidentUseCases } from '@/server/modules/incidents/incident.use-cases';
import { IncidentStateError } from '@/server/modules/incidents/incident-state-machine';
import { db } from '@/lib/db';

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: { emit: vi.fn().mockResolvedValue(undefined) },
  OutboxEventTypes: { NOTIFICATION_SEND: 'NOTIFICATION_SEND' },
}));
vi.mock('@/lib/audit-log', () => ({ createAuditLog: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { OutboxService } from '@/server/workers/outbox';

describe('P0-1: list formatter returns photos + timeline', () => {
  it('shapes every row with photos, timeline, insuranceClaimNumber and assignedToName', async () => {
    const findMany = vi.spyOn(db.incident, 'findMany').mockResolvedValue([
      {
        id: 'i1',
        incidentId: 'INC-1',
        riderId: 'r1',
        rider: { fullName: 'Rider One', riderId: 'RID-1', phone: '999' },
        vehicleId: null,
        vehicle: null,
        type: 'ACCIDENT',
        severity: 'HIGH',
        title: 'T',
        description: 'D',
        location: 'L',
        latitude: null,
        longitude: null,
        photos: ['https://cdn/x.jpg'],
        status: 'OPEN',
        assignedTo: null,
        assignedToId: null,
        assignedAdmin: null,
        insuranceClaim: true,
        insuranceClaimNumber: 'CLM-1',
        resolution: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);
    const count = vi.spyOn(db.incident, 'count').mockResolvedValue(1 as any);

    const result = await incidentUseCases.list({ page: 1, limit: 20 });
    const row = result.incidents[0];
    expect(row.photos).toEqual(['https://cdn/x.jpg']);
    expect(row.timeline).toEqual([]);
    expect(row.insuranceClaim).toBe(true);
    expect(row.insuranceClaimNumber).toBe('CLM-1');
    expect(row.assignedToName).toBeNull();
    findMany.mockRestore();
    count.mockRestore();
  });

  it('returns assignedToName from the assignedAdmin relation', async () => {
    const findMany = vi.spyOn(db.incident, 'findMany').mockResolvedValue([
      {
        id: 'i1',
        incidentId: 'INC-1',
        riderId: null,
        rider: null,
        vehicleId: null,
        vehicle: null,
        type: 'OTHER',
        severity: 'LOW',
        title: 'T',
        description: 'D',
        location: null,
        latitude: null,
        longitude: null,
        photos: null,
        status: 'OPEN',
        assignedTo: 'a1',
        assignedToId: 'a1',
        assignedAdmin: { id: 'a1', name: 'Alice Admin' },
        insuranceClaim: false,
        insuranceClaimNumber: null,
        resolution: null,
        resolvedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ] as any);
    const count = vi.spyOn(db.incident, 'count').mockResolvedValue(1 as any);

    const result = await incidentUseCases.list({ page: 1, limit: 20 });
    expect(result.incidents[0].assignedToName).toBe('Alice Admin');
    findMany.mockRestore();
    count.mockRestore();
  });
});

describe('P2-8: rider.phone search is case-insensitive', () => {
  it('includes mode: insensitive in the phone OR branch', async () => {
    const findMany = vi.spyOn(db.incident, 'findMany').mockResolvedValue([] as any);
    const count = vi.spyOn(db.incident, 'count').mockResolvedValue(0 as any);

    await incidentUseCases.list({ search: '9999', page: 1, limit: 20 });
    const where = (findMany.mock.calls[0] as any)[0].where;
    expect(where.OR).toContainEqual({
      rider: { phone: { contains: '9999', mode: 'insensitive' } },
    });
    findMany.mockRestore();
    count.mockRestore();
  });
});

describe('P1-1/P1-5/P2-4/P2-7: create', () => {
  const tx = () => ({
    incident: { create: vi.fn() },
    vehicle: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists insuranceClaim + insuranceClaimNumber', async () => {
    const t = tx();
    t.incident.create.mockResolvedValue({
      id: 'i1',
      incidentId: 'INC-1',
      riderId: null,
      description: 'D',
      title: 'T',
    });
    const txSpy = vi.spyOn(db, '$transaction').mockImplementation(
      async (fn: any) => fn(t)
    );
    const riderSpy = vi.spyOn(db.rider, 'findUnique');

    await incidentUseCases.create(
      {
        type: 'DAMAGE',
        severity: 'MEDIUM',
        title: 'Bumper',
        description: 'Scratched during inspection.',
        insuranceClaim: true,
        insuranceClaimNumber: 'CLM-9',
      },
      'admin_1'
    );

    const created = (t.incident.create as any).mock.calls[0][0].data;
    expect(created.insuranceClaim).toBe(true);
    expect(created.insuranceClaimNumber).toBe('CLM-9');
    txSpy.mockRestore();
    riderSpy.mockRestore();
  });

  it('guards the vehicle→MAINTENANCE flip to AVAILABLE/ASSIGNED (P1-5)', async () => {
    const t = tx();
    t.incident.create.mockResolvedValue({
      id: 'i1',
      incidentId: 'INC-1',
      riderId: 'r1',
      description: 'D',
      title: 'T',
    });
    const txSpy = vi.spyOn(db, '$transaction').mockImplementation(
      async (fn: any) => fn(t)
    );
    const vehicleSpy = vi
      .spyOn(db.vehicle, 'findUnique')
      .mockResolvedValue({ id: 'v1' } as any);

    await incidentUseCases.create(
      {
        vehicleId: 'v1',
        type: 'ACCIDENT',
        severity: 'CRITICAL',
        title: 'Crash',
        description: 'Collision at junction.',
      },
      'admin_1'
    );

    expect(t.vehicle.updateMany).toHaveBeenCalledWith({
      where: { id: 'v1', status: { in: ['AVAILABLE', 'ASSIGNED'] } },
      data: { status: 'MAINTENANCE' },
    });
    txSpy.mockRestore();
    vehicleSpy.mockRestore();
  });

  it('retries P2002 on the unique incidentId (P2-4)', async () => {
    const t = tx();
    t.incident.create
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockRejectedValueOnce({ code: 'P2002' })
      .mockResolvedValueOnce({
        id: 'i1',
        incidentId: 'INC-X',
        riderId: null,
        description: 'D',
        title: 'T',
      });
    const txSpy = vi.spyOn(db, '$transaction').mockImplementation(
      async (fn: any) => fn(t)
    );

    const result = await incidentUseCases.create(
      { type: 'OTHER', severity: 'LOW', title: 'T', description: 'Description here' },
      'admin_1'
    );
    expect(result.incidentId).toBe('INC-X');
    expect(t.incident.create).toHaveBeenCalledTimes(3);
    txSpy.mockRestore();
  });

  it('emits a NOTIFICATION_SEND outbox event when a rider is involved (P2-7)', async () => {
    const t = tx();
    t.incident.create.mockResolvedValue({
      id: 'i1',
      incidentId: 'INC-1',
      riderId: 'r1',
      description: 'D',
      title: 'T',
    });
    const txSpy = vi.spyOn(db, '$transaction').mockImplementation(
      async (fn: any) => fn(t)
    );
    const riderSpy = vi
      .spyOn(db.rider, 'findUnique')
      .mockResolvedValue({ id: 'r1' } as any);

    await incidentUseCases.create(
      { riderId: 'r1', type: 'THEFT', severity: 'HIGH', title: 'Stolen', description: 'Bike missing.' },
      'admin_1'
    );

    expect(OutboxService.emit).toHaveBeenCalledWith(
      'NOTIFICATION_SEND',
      expect.objectContaining({ riderId: 'r1', type: 'INCIDENT_UPDATE', incidentId: 'INC-1' }),
      expect.any(Number),
      undefined,
      'interactive'
    );
    txSpy.mockRestore();
    riderSpy.mockRestore();
  });
});

describe('P1-2: updateIncident writes the D-P2-8 relations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('validates the admin and writes assignedToId on assignment', async () => {
    const findUnique = vi
      .spyOn(db.incident, 'findUnique')
      .mockResolvedValue({ status: 'OPEN' } as any);
    const adminSpy = vi
      .spyOn(db.admin, 'findUnique')
      .mockResolvedValue({ id: 'a1', name: 'Alice' } as any);
    const updateSpy = vi.spyOn(db.incident, 'update').mockResolvedValue({
      id: 'i1',
      riderId: null,
      incidentId: 'INC-1',
    } as any);

    await incidentUseCases.updateIncident('i1', { assignedTo: 'a1' }, 'admin_9');

    const data = (updateSpy.mock.calls[0] as any)[0].data;
    expect(adminSpy).toHaveBeenCalledWith({
      where: { id: 'a1' },
      select: { id: true, name: true },
    });
    expect(data.assignedToId).toBe('a1');
    findUnique.mockRestore();
    adminSpy.mockRestore();
    updateSpy.mockRestore();
  });

  it('throws ASSIGNED_ADMIN_NOT_FOUND for an unknown admin id', async () => {
    const findUnique = vi
      .spyOn(db.incident, 'findUnique')
      .mockResolvedValue({ status: 'OPEN' } as any);
    const adminSpy = vi.spyOn(db.admin, 'findUnique').mockResolvedValue(null as any);
    const updateSpy = vi.spyOn(db.incident, 'update');

    await expect(
      incidentUseCases.updateIncident('i1', { assignedTo: 'ghost' }, 'admin_9')
    ).rejects.toThrow('ASSIGNED_ADMIN_NOT_FOUND');
    expect(updateSpy).not.toHaveBeenCalled();
    findUnique.mockRestore();
    adminSpy.mockRestore();
    updateSpy.mockRestore();
  });

  it('writes resolvedById on RESOLVED (not just the legacy column)', async () => {
    const findUnique = vi
      .spyOn(db.incident, 'findUnique')
      .mockResolvedValue({ status: 'OPEN' } as any);
    const updateSpy = vi.spyOn(db.incident, 'update').mockResolvedValue({
      id: 'i1',
      riderId: null,
      incidentId: 'INC-1',
    } as any);

    await incidentUseCases.updateIncident('i1', { status: 'RESOLVED' }, 'admin_5');

    const data = (updateSpy.mock.calls[0] as any)[0].data;
    expect(data.resolvedById).toBe('admin_5');
    expect(data.resolvedBy).toBe('admin_5');
    expect(data.resolvedAt).toBeInstanceOf(Date);
    findUnique.mockRestore();
    updateSpy.mockRestore();
  });

  it('rejects machine-illegal transitions with IncidentStateError', async () => {
    const findUnique = vi
      .spyOn(db.incident, 'findUnique')
      .mockResolvedValue({ status: 'CLOSED' } as any);
    const updateSpy = vi.spyOn(db.incident, 'update');

    // CLOSED → RESOLVED is not in the machine.
    await expect(
      incidentUseCases.updateIncident('i1', { status: 'RESOLVED' }, 'admin_5')
    ).rejects.toBeInstanceOf(IncidentStateError);
    expect(updateSpy).not.toHaveBeenCalled();
    findUnique.mockRestore();
    updateSpy.mockRestore();
  });
});