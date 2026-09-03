import { vehicleRepository } from './vehicle.repository';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { VehicleStatus, Prisma } from '@prisma/client';
import { invalidateCache } from '@/lib/cache';

export const vehicleUseCases = {
  async listVehicles(params?: { hubId?: string; status?: VehicleStatus }) {
    return vehicleRepository.findAll(params);
  },

  async getVehicle(vehicleId: string) {
    return vehicleRepository.findById(vehicleId);
  },

  async getVehiclesByHub(hubId: string) {
    return vehicleRepository.findByHubId(hubId);
  },

  async createVehicle(input: Prisma.VehicleCreateInput) {
    const result = await vehicleRepository.create(input);
    invalidateCache('vehicles_list:*');
    return result;
  },

  async updateVehicle(vehicleId: string, input: Prisma.VehicleUpdateInput) {
    const result = await vehicleRepository.update(vehicleId, input);
    invalidateCache('vehicles_list:*');
    return result;
  },

  async assignVehicle(vehicleId: string, riderDbId: string) {
    const [vehicle, rider, existingRental] = await Promise.all([
      db.vehicle.findUnique({ where: { id: vehicleId, deletedAt: null } }),
      db.rider.findUnique({ where: { id: riderDbId } }),
      // P1.11: the old check `status: 'ACTIVE'` let a rider with an OVERDUE
      // (or BOOKED / RETURN_PENDING / SUSPENDED) lease get a second vehicle
      // assigned. Any lease that is not CLOSED is still an open rental.
      db.rentalLease.findFirst({ where: { riderId: riderDbId, status: { not: 'CLOSED' } } }),
    ]);

    if (!vehicle || vehicle.status !== 'AVAILABLE') {
      throw new Error('Vehicle is not available for assignment');
    }
    if (!rider || rider.lifecycleStatus !== 'ACTIVE') {
      throw new Error('Rider is not in ACTIVE state');
    }
    if (existingRental) {
      throw new Error('Rider already has an open rental');
    }

    const result = await vehicleRepository.assignToRider(vehicleId, riderDbId);
    invalidateCache('vehicles_list:*');
    return result;
  },

  async markForMaintenance(vehicleId: string) {
    const activeLease = await db.rentalLease.findFirst({
      where: { vehicleId, status: 'ACTIVE' },
    });
    if (activeLease) {
      throw new Error(
        'Vehicle is currently on an active rental and cannot be marked for maintenance'
      );
    }
    const result = await vehicleRepository.update(vehicleId, { status: 'MAINTENANCE' });
    invalidateCache('vehicles_list:*');
    return result;
  },

  /**
   * List vehicles with hub info, pagination, and active leases for admin panel.
   */
  async listAdminVehicles(params: {
    status?: string;
    hubId?: string;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { status, hubId, search, page, limit } = params;
    // P1.6: soft-deleted vehicles must not appear in the admin list.
    const where: Record<string, unknown> = { deletedAt: null };
    if (status) where.status = status;
    if (hubId) where.hubId = hubId;
    // P0 fleet fix: server-side search so pagination is meaningful. The old
    // client filtered only the current page (useVehicleManagement.filtered).
    if (search) {
      const s = search.trim();
      if (s) {
        (where as Record<string, unknown>).OR = [
          { vehicleNumber: { contains: s, mode: 'insensitive' } },
          { vehicleId: { contains: s, mode: 'insensitive' } },
          { model: { contains: s, mode: 'insensitive' } },
        ];
      }
    }

    const [vehicles, total, hubs] = await Promise.all([
      db.vehicle.findMany({
        where,
        include: {
          hub: { select: { name: true, city: true } },
          returns: { orderBy: { createdAt: 'desc' }, take: 1 },
          leases: {
            where: { status: 'ACTIVE' },
            take: 1,
            include: { rider: { select: { fullName: true, riderId: true } } },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.vehicle.count({ where }),
      db.hub.findMany({ select: { id: true, name: true } }),
    ]);

    return {
      vehicles,
      hubs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  /**
   * Check vehicle uniqueness by number.
   */
  async existsByNumber(vehicleNumber: string) {
    return db.vehicle.findUnique({ where: { vehicleNumber } });
  },

  /**
   * Get next vehicle ID.
   */
  async getNextId() {
    const count = await db.vehicle.count();
    return `VF-VH-${String(count + 1).padStart(6, '0')}`;
  },

  /**
   * List vehicles at a hub with lease status for rider-facing view.
   */
  async getVehiclesAtHub(hubId: string) {
    const hub = await db.hub.findUnique({
      where: { id: hubId },
      select: { id: true, name: true, isActive: true },
    });
    if (!hub) throw new Error('Hub not found');

    const vehicles = await db.vehicle.findMany({
      where: { hubId, deletedAt: null },
      orderBy: [{ status: 'asc' }, { model: 'asc' }],
      include: {
        leases: {
          where: { status: { in: ['BOOKED', 'ACTIVE'] } },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: {
            rider: { select: { id: true, riderId: true, fullName: true } },
            shift: { select: { id: true, name: true, startTime: true, endTime: true } },
          },
        },
      },
    });

    const vehiclesData = vehicles.map((vehicle) => {
      const activeLease = vehicle.leases[0] || null;
      return {
        id: vehicle.id,
        vehicleId: vehicle.vehicleId,
        vehicleNumber: vehicle.vehicleNumber,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
        batteryLevel: vehicle.batteryLevel,
        status: vehicle.status,
        currentLease: activeLease
          ? {
              id: activeLease.id,
              status: activeLease.status,
              leaseDate: activeLease.leaseDate,
              startTime: activeLease.startTime,
              endTime: activeLease.endTime,
              rider: {
                id: activeLease.rider.id,
                riderId: activeLease.rider.riderId,
                name: activeLease.rider.fullName,
              },
              shift: {
                id: activeLease.shift.id,
                name: activeLease.shift.name,
                startTime: activeLease.shift.startTime,
                endTime: activeLease.shift.endTime,
              },
            }
          : null,
      };
    });

    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter((v) => v.status === 'AVAILABLE').length;

    return { hubName: hub.name, totalVehicles, availableVehicles, vehicles: vehiclesData };
  },

  async verifyPickupVehicle(query: string, hubId: string) {
    const vehicle = await db.vehicle.findFirst({
      where: {
        OR: [
          { id: query },
          { vehicleId: query },
          { vehicleNumber: query },
          { id: { contains: query, mode: 'insensitive' } },
          { vehicleNumber: { contains: query, mode: 'insensitive' } },
        ],
        hubId,
        deletedAt: null,
      },
      include: { hub: { select: { id: true, name: true } } },
    });
    if (!vehicle) throw new Error('Vehicle not found at this hub');
    return {
      id: vehicle.id,
      vehicleId: vehicle.vehicleId,
      vehicleNumber: vehicle.vehicleNumber,
      model: vehicle.model,
      status: vehicle.status,
      hubId: vehicle.hubId,
      hub: vehicle.hub,
    };
  },

  async getVehicleHistory(vehicleId: string) {
    return vehicleRepository.findVehicleHistory(vehicleId);
  },

  /**
   * P1.7/P3.15 (2026-08-05 rentals/vehicles/hubs audit): admin DELETE now
   * 404s on an unknown id (the old code silently returned 200 with no write)
   * and 409s when the vehicle is on an active lease — mirroring
   * markForMaintenance. Retires the vehicle (soft delete) on success.
   */
  async retireVehicle(vehicleId: string, actorId: string) {
    const vehicle = await vehicleRepository.findById(vehicleId);
    if (!vehicle) throw new Error('VEHICLE_NOT_FOUND');
    const activeLease = await db.rentalLease.findFirst({
      where: { vehicleId, status: { in: ['BOOKED', 'ACTIVE', 'RETURN_PENDING'] } },
    });
    if (activeLease) throw new Error('VEHICLE_HAS_ACTIVE_LEASE');

    const result = await vehicleRepository.update(vehicleId, { status: 'RETIRED' });
    invalidateCache('vehicles_list:*');
    invalidateCache('admin:vehicles:*');
    createAuditLog({
      actorId,
      action: 'vehicle.retire',
      entity: 'vehicle',
      entityId: vehicleId,
      details: {
        vehicleNumber: vehicle.vehicleNumber,
        vehicleId: vehicle.vehicleId,
      },
    }).catch((e: unknown) => logger.error('Audit log failed for vehicle retire', e));
    return result;
  },

  async bulkUpdateVehicles(
    ids: string[],
    action: string,
    value: string | undefined,
    actorId: string
  ) {
    let updatedCount = 0;
    let auditAction = '';

    switch (action) {
      case 'changeStatus': {
        if (!value) throw new Error('Status value is required');
        const result = await vehicleRepository.bulkUpdateStatus(ids, {
          status: value as VehicleStatus,
        });
        updatedCount = result.count;
        auditAction = 'vehicle.bulk_change_status';
        break;
      }
      case 'reassignHub': {
        if (!value) throw new Error('Hub ID is required');
        const result = await db.vehicle.updateMany({
          where: { id: { in: ids } },
          data: { hubId: value },
        });
        updatedCount = result.count;
        auditAction = 'vehicle.bulk_reassign_hub';
        break;
      }
      case 'delete': {
        const result = await vehicleRepository.bulkDelete(ids);
        updatedCount = result.count;
        auditAction = 'vehicle.bulk_delete';
        break;
      }
      default:
        throw new Error('Invalid action');
    }

    createAuditLog({
      actorId,
      action: auditAction,
      entity: 'vehicle',
      entityId: 'multiple',
      details: { ids, ...(value ? { value } : {}), count: updatedCount },
    }).catch((e: unknown) => logger.error('Audit log failed for bulk vehicle action', e));

    invalidateCache('vehicles_list:*');
    invalidateCache('admin:vehicles:*');
    return { count: updatedCount };
  },
};
