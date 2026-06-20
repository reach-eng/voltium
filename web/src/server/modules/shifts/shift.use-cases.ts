import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

// ── Helper ─────────────────────────────────────────────────────────────────

interface ShiftPart {
  startTime: string;
  endTime: string;
}

function parseParts(partsJson: string | null | undefined): ShiftPart[] {
  if (!partsJson) return [];
  try {
    return JSON.parse(partsJson) as ShiftPart[];
  } catch {
    return [];
  }
}

/**
 * Given an optional parts array and fallback startTime/endTime,
 * returns the parts to store and the display startTime/endTime.
 */
function computeShiftTimes(
  parts: ShiftPart[] | undefined | null,
  startTime?: string,
  endTime?: string,
): { partsJson: string | null; startTime: string; endTime: string } {
  if (parts && parts.length > 0) {
    const sorted = [...parts].sort((a, b) => a.startTime.localeCompare(b.startTime));
    return {
      partsJson: JSON.stringify(sorted),
      startTime: sorted[0].startTime,
      endTime: sorted[sorted.length - 1].endTime,
    };
  }
  // Fallback to plain startTime/endTime (no parts)
  return {
    partsJson: null,
    startTime: startTime || '00:00',
    endTime: endTime || '00:00',
  };
}

/**
 * Attach parsed parts to a shift object for the response.
 */
function attachParts(shift: any) {
  return {
    ...shift,
    parts: parseParts(shift.parts),
  };
}

// ── Use Cases ──────────────────────────────────────────────────────────────

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
    const hubVehicleIds = hubVehicles.map((v: { id: string }) => v.id);
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
    const shiftsData = shifts.map((shift: any) => {
      const currentBookings = countMap.get(shift.id) ?? 0;
      return {
        id: shift.id,
        name: shift.name,
        startTime: shift.startTime,
        endTime: shift.endTime,
        parts: parseParts(shift.parts),
        maxBookings: shift.maxBookings,
        currentBookings,
        availableSlots: Math.max(0, shift.maxBookings - currentBookings),
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
    const shifts = await db.shift.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: { _count: { select: { leases: true } } },
    });
    return shifts.map(attachParts);
  },

  async createShift(data: any, actorId: string) {
    const { parts: inputParts, ...rest } = data;
    const { partsJson, startTime, endTime } = computeShiftTimes(inputParts, rest.startTime, rest.endTime);
    const createData: any = {
      ...rest,
      startTime,
      endTime,
    };
    if (partsJson) {
      createData.parts = partsJson;
    }
    const shift = await db.shift.create({ data: createData as any });
    createAuditLog({ actorId, action: 'shift.create', entity: 'shift', entityId: shift.id, details: { name: data.name } }).catch(() => {});
    return attachParts(shift);
  },

  async updateShift(id: string, data: any, actorId: string) {
    const { parts: inputParts, ...rest } = data;
    const updateData: any = { ...rest };

    if (inputParts !== undefined) {
      const { partsJson, startTime, endTime } = computeShiftTimes(inputParts, rest.startTime, rest.endTime);
      updateData.startTime = startTime;
      updateData.endTime = endTime;
      updateData.parts = partsJson;
    }

    const shift = await db.shift.update({ where: { id }, data: updateData as any });
    createAuditLog({ actorId, action: 'shift.update', entity: 'shift', entityId: id, details: data as Record<string, unknown> }).catch(() => {});
    return attachParts(shift);
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
