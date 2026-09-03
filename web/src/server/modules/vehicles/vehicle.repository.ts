import { db } from '@/lib/db';
import { VehicleStatus, Prisma } from '@prisma/client';
import { getCachedVehicle, invalidateVehicleCache } from '@/lib/server-cache';

export const vehicleRepository = {
  // P1.6: soft-deleted vehicles (deletedAt set) must never reappear in lists.
  async findAll(params?: { hubId?: string; status?: VehicleStatus }) {
    return db.vehicle.findMany({
      where: {
        deletedAt: null,
        ...(params?.hubId ? { hubId: params.hubId } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
      orderBy: { vehicleNumber: 'asc' },
    });
  },

  // P2.8: callers pass either the internal cuid OR the public `vehicleId`
  // string — resolve both so the lookup succeeds regardless of which
  // identifier the caller has (cache keys still key on the passed param,
  // which only causes mild duplication, never wrong results).
  async findById(vehicleId: string) {
    return getCachedVehicle(vehicleId, () =>
      db.vehicle.findFirst({
        where: { OR: [{ id: vehicleId }, { vehicleId }], deletedAt: null },
      })
    );
  },

  async findByHubId(hubId: string) {
    return db.vehicle.findMany({
      where: { hubId, deletedAt: null },
      orderBy: { vehicleNumber: 'asc' },
    });
  },

  async create(data: Prisma.VehicleCreateInput) {
    return db.vehicle.create({ data });
  },

  async update(vehicleId: string, data: Prisma.VehicleUpdateInput) {
    const result = await db.vehicle.update({ where: { id: vehicleId }, data });
    invalidateVehicleCache(vehicleId);
    return result;
  },

  async assignToRider(vehicleId: string, riderDbId: string) {
    // In schema, Rider is the parent of vehicleId relation.
    // Update Rider model to assign vehicle, and update Vehicle status.
    await db.rider.update({
      where: { id: riderDbId },
      data: { vehicleId },
    });
    const result = await db.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'ASSIGNED' },
    });
    invalidateVehicleCache(vehicleId);
    return result;
  },

  async markAvailable(vehicleId: string) {
    // Unlink vehicle from riders
    await db.rider.updateMany({
      where: { vehicleId },
      data: { vehicleId: null },
    });
    const result = await db.vehicle.update({
      where: { id: vehicleId },
      data: { status: 'AVAILABLE' },
    });
    invalidateVehicleCache(vehicleId);
    return result;
  },

  async findVehicleHistory(vehicleId: string) {
    const [leases, supportTickets, returns] = await Promise.all([
      db.rentalLease.findMany({
        where: { vehicleId },
        include: { rider: { select: { fullName: true, riderId: true, phone: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.supportTicket.findMany({
        where: { vehicleId },
        include: { rider: { select: { fullName: true, riderId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      db.vehicleReturn.findMany({
        where: { vehicleId },
        include: { rider: { select: { fullName: true, riderId: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { leases, supportTickets, returns };
  },

  async bulkUpdateStatus(ids: string[], data: Prisma.VehicleUpdateManyMutationInput) {
    const result = await db.vehicle.updateMany({ where: { id: { in: ids } }, data });
    for (const id of ids) invalidateVehicleCache(id);
    return result;
  },

  // P1.6/P2.5: bulk delete was a HARD deleteMany while the single-delete path
  // retired the vehicle — same action, opposite durability. Unify on soft
  // delete: set deletedAt + RETIRED; every read path filters deletedAt: null.
  async bulkDelete(ids: string[]) {
    const activeLeases =
      typeof db.rentalLease?.count === 'function'
        ? await db.rentalLease.count({
            where: {
              vehicleId: { in: ids },
              status: {
                in: [
                  'BOOKED',
                  'PICKUP_SCHEDULED',
                  'ACTIVE',
                  'OVERDUE',
                  'RETURN_PENDING',
                  'SUSPENDED',
                ],
              },
            },
          })
        : 0;
    if (activeLeases > 0) {
      throw new Error(
        `Cannot delete vehicles: ${activeLeases} vehicle(s) currently have active or booked rental leases`
      );
    }

    const result = await db.vehicle.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), status: 'RETIRED' },
    });
    for (const id of ids) invalidateVehicleCache(id);
    return result;
  },
};
