import { db } from '@/lib/db';
import { VehicleStatus, Prisma } from '@prisma/client';
import { getCachedVehicle, invalidateVehicleCache } from '@/lib/server-cache';

export const vehicleRepository = {
  async findAll(params?: { hubId?: string; status?: VehicleStatus }) {
    return db.vehicle.findMany({
      where: {
        ...(params?.hubId ? { hubId: params.hubId } : {}),
        ...(params?.status ? { status: params.status } : {}),
      },
      orderBy: { vehicleNumber: 'asc' },
    });
  },

  async findById(vehicleId: string) {
    return getCachedVehicle(vehicleId, () => db.vehicle.findUnique({ where: { id: vehicleId } }));
  },

  async findByHubId(hubId: string) {
    return db.vehicle.findMany({ where: { hubId }, orderBy: { vehicleNumber: 'asc' } });
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

  async bulkDelete(ids: string[]) {
    const result = await db.vehicle.deleteMany({ where: { id: { in: ids } } });
    for (const id of ids) invalidateVehicleCache(id);
    return result;
  },
};
