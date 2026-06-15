import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

export const shiftUseCases = {
  async getShifts(hubId: string, date?: string) {
    let leaseDate = date;
    if (!leaseDate) {
      leaseDate = new Date().toISOString().split('T')[0];
    }
    const hub = await db.hub.findUnique({ where: { id: hubId }, select: { id: true, name: true, isActive: true } });
    if (!hub) throw new Error('Hub not found');
    if (!hub.isActive) throw new Error('Hub is currently inactive');
    const shifts = await db.shift.findMany({ where: { isActive: true }, orderBy: [{ startTime: 'asc' }] });
    const hubVehicles = await db.vehicle.findMany({ where: { hubId }, select: { id: true } });
    const hubVehicleIds = hubVehicles.map((v) => v.id);
    const bookingCounts = hubVehicleIds.length > 0
      ? (await db.rentalLease.groupBy({
          by: ['shiftId'],
          where: { vehicleId: { in: hubVehicleIds }, leaseDate, status: { in: ['BOOKED', 'ACTIVE'] } },
          _count: { id: true },
        })) as unknown as Array<{ shiftId: string; _count: { id: number } }>
      : [];
    const countMap = new Map<string, number>();
    for (const bc of bookingCounts) {
      countMap.set(bc.shiftId, bc._count.id);
    }
    const shiftsData = shifts.map((shift) => {
      const currentBookings = countMap.get(shift.id) ?? 0;
      return {
        id: shift.id, name: shift.name, startTime: shift.startTime, endTime: shift.endTime,
        maxBookings: shift.maxBookings, currentBookings, availableSlots: Math.max(0, shift.maxBookings - currentBookings),
        isAvailable: currentBookings < shift.maxBookings,
      };
    });
    return { hub: { id: hub.id, name: hub.name }, date: leaseDate, shifts: shiftsData };
  },

  async listShifts(search?: string, activeOnly?: boolean) {
    const where: any = {};
    if (activeOnly) where.isActive = true;
    if (search) {
      where.OR = [{ name: { contains: search, mode: 'insensitive' as const } }];
    }
    return db.shift.findMany({ where, orderBy: { startTime: 'asc' }, include: { _count: { select: { leases: true } } } });
  },

  async createShift(data: any, actorId: string) {
    const shift = await db.shift.create({ data: data as any });
    createAuditLog({ actorId, action: 'shift.create', entity: 'shift', entityId: shift.id, details: { name: data.name } }).catch(() => {});
    return shift;
  },

  async updateShift(id: string, data: any, actorId: string) {
    const shift = await db.shift.update({ where: { id }, data: data as any });
    createAuditLog({ actorId, action: 'shift.update', entity: 'shift', entityId: id, details: data as Record<string, unknown> }).catch(() => {});
    return shift;
  },

  async deleteShift(id: string, actorId: string) {
    const leaseCount = await db.rentalLease.count({ where: { shiftId: id } });
    if (leaseCount > 0) {
      throw new Error(`Cannot delete shift: ${leaseCount} lease(s) are using it. Remove them first.`);
    }
    await db.shift.delete({ where: { id } });
    createAuditLog({ actorId, action: 'shift.delete', entity: 'shift', entityId: id }).catch(() => {});
  },
};
