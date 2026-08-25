import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';

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
  endTime?: string
): { partsJson: string | null; startTime: string; endTime: string } {
  if (parts && parts.length > 0) {
    // Admin Panel Phase 3 P2-04 (2026-08-23): reject parts
    // where start === end (a zero-length block is
    // nonsensical and was previously silently accepted).
    for (const p of parts) {
      if (p.startTime === p.endTime) {
        throw new Error(
          `Invalid shift part: startTime (${p.startTime}) and endTime (${p.endTime}) must differ.`
        );
      }
    }
    // Admin Panel Phase 4 / Batch C (2026-08-23): allow cross-midnight
    // parts (endTime < startTime in wall-clock terms, e.g. 23:00 -> 04:00
    // is a night-delivery block that crosses midnight). The previous
    // implementation rejected any such part as "endTime before startTime",
    // which forced operators to split a single overnight block into
    // awkward 23:00 -> 23:59 and 00:00 -> 04:00 pieces and lose the
    // semantic that they were one shift. The fix: only reject
    // endTime < startTime for *non-crossing* parts. The shift
    // store uses "HH:MM" as opaque strings, so callers indicate a
    // crossing by the time pattern; the endTime is taken at face
    // value (e.g. 04:00 as a wall-clock end-of-shift, regardless
    // of whether the same date was the start date).
    //
    // Latest-endTime semantics: for cross-midnight parts, the endTime
    // wall-clock is *earlier* on the next day. To compare two ends
    // across parts (e.g. 23:00 vs 04:00), we treat the cross-midnight
    // end as +24h in a virtual "minutes-since-shift-start" space,
    // take the max, and then output the *wall-clock* endTime of the
    // winning part (NOT a normalized 28:00 string). This matches
    // the operator's mental model: a 18:00-23:00 + 23:00-04:00
    // pair ends at 04:00, not 23:00.
    const sorted = [...parts].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const minutesFromShiftStart = (p: ShiftPart): number => {
      const [sh, sm] = p.startTime.split(':').map(Number);
      const [eh, em] = p.endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      const endMins = eh * 60 + em;
      // Cross-midnight: add 24h (1440 mins) to the endMins so it's
      // numerically later than any same-day end.
      const crosses = endMins < startMins;
      return endMins + (crosses ? 1440 : 0);
    };
    const winning = parts.reduce((best, p) =>
      minutesFromShiftStart(p) > minutesFromShiftStart(best) ? p : best
    );
    return {
      partsJson: JSON.stringify(sorted),
      startTime: sorted[0].startTime,
      endTime: winning.endTime,
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
function attachParts(shift: { parts: string | null }) {
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
      leaseDate = formatDateDDMMYYYY(new Date());
    }
    const hub = await db.hub.findUnique({
      where: { id: hubId },
      select: { id: true, name: true, isActive: true },
    });
    if (!hub) throw new Error('Hub not found');
    if (!hub.isActive) throw new Error('Hub is currently inactive');
    const shifts = await db.shift.findMany({
      where: { isActive: true },
      orderBy: [{ startTime: 'asc' }],
    });
    const hubVehicles = await db.vehicle.findMany({ where: { hubId }, select: { id: true } });
    const hubVehicleIds = hubVehicles.map((v: { id: string }) => v.id);
    const bookingCounts =
      hubVehicleIds.length > 0
        ? ((await db.rentalLease.groupBy({
            by: ['shiftId'],
            where: {
              vehicleId: { in: hubVehicleIds },
              leaseDate,
              status: { in: ['BOOKED', 'ACTIVE'] },
            },
            _count: { id: true },
          })) as unknown as Array<{ shiftId: string; _count: { id: number } }>)
        : [];
    const countMap = new Map<string, number>();
    for (const bc of bookingCounts) {
      countMap.set(bc.shiftId, bc._count.id);
    }
    const shiftsData = shifts.map((shift) => {
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
    const where: Prisma.ShiftWhereInput = {
      // S-2 (W8): exclude soft-deleted (archived) shifts
      deletedAt: null,
    };
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

  async createShift(data: Record<string, unknown>, actorId: string) {
    const { parts: inputParts, ...rest } = data;
    const { partsJson, startTime, endTime } = computeShiftTimes(
      inputParts as ShiftPart[] | undefined | null,
      rest.startTime as string | undefined,
      rest.endTime as string | undefined
    );
    const createData: Prisma.ShiftCreateInput = {
      ...(rest as Prisma.ShiftCreateInput),
      startTime,
      endTime,
    };
    if (partsJson) {
      createData.parts = partsJson;
    }
    const shift = await db.shift.create({ data: createData });
    createAuditLog({
      actorId,
      action: 'shift.create',
      entity: 'shift',
      entityId: shift.id,
      details: { name: data.name },
    }).catch(() => {});
    return attachParts(shift);
  },

  async updateShift(id: string, data: Record<string, unknown>, actorId: string) {
    const { parts: inputParts, ...rest } = data;
    const updateData: Prisma.ShiftUpdateInput = { ...(rest as Prisma.ShiftUpdateInput) };

    if (inputParts !== undefined) {
      const { partsJson, startTime, endTime } = computeShiftTimes(
        inputParts as ShiftPart[] | undefined | null,
        rest.startTime as string | undefined,
        rest.endTime as string | undefined
      );
      updateData.startTime = startTime;
      updateData.endTime = endTime;
      updateData.parts = partsJson;
    }

    const shift = await db.shift.update({ where: { id }, data: updateData });
    createAuditLog({
      actorId,
      action: 'shift.update',
      entity: 'shift',
      entityId: id,
      details: data as Record<string, unknown>,
    }).catch(() => {});
    return attachParts(shift);
  },

  async deleteShift(id: string, actorId: string) {
    // S-2 (W8-1): Full non-closed-status guard. Previously only BOOKED + ACTIVE
    // were checked, leaving PICKUP_SCHEDULED, OVERDUE, RETURN_PENDING, and
    // SUSPENDED unguarded. Any of these is a live rental that would be orphaned
    // if the shift were removed. Historical CLOSED/COMPLETED rows are excluded.
    const NON_CLOSED_LEASE_STATUSES = [
      'BOOKED',
      'PICKUP_SCHEDULED',
      'ACTIVE',
      'OVERDUE',
      'RETURN_PENDING',
      'SUSPENDED',
    ] as const;

    const leaseCount = await db.rentalLease.count({
      where: {
        shiftId: id,
        status: { in: [...NON_CLOSED_LEASE_STATUSES] },
      },
    });
    if (leaseCount > 0) {
      throw new Error(
        `Cannot delete shift: ${leaseCount} non-closed lease(s) are using it. ` +
        `Close or reassign them first.`
      );
    }

    // S-2 (W8-2): Soft-delete instead of hard-delete. The Shift → RentalLease FK
    // uses Restrict, so hard-deleting a shift with ANY historical (CLOSED/COMPLETED)
    // lease rows will 500 with a P2003 constraint violation. Soft-delete preserves
    // referential integrity, removes the shift from all active lists, and is
    // recoverable by an admin if needed.
    await db.shift.update({
      where: { id },
      data: { isActive: false, deletedAt: new Date() },
    });
    createAuditLog({ actorId, action: 'shift.archive', entity: 'shift', entityId: id }).catch(
      () => {}
    );
    return { id };
  },
};
