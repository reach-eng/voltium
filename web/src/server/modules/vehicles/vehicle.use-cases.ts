/**
 * Vehicles module - Use cases.
 *
 * Orchestrates vehicle inventory management, assignment, and status changes.
 */

import { vehicleRepository } from './vehicle.repository';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const vehicleUseCases = {
  async listVehicles(params?: { hubId?: string; status?: string }) {
    return vehicleRepository.findAll(params);
  },

  async getVehicle(vehicleId: string) {
    return vehicleRepository.findById(vehicleId);
  },

  async getVehiclesByHub(hubId: string) {
    return vehicleRepository.findByHubId(hubId);
  },

  async createVehicle(input: Record<string, unknown>) {
    return vehicleRepository.create(input);
  },

  async updateVehicle(vehicleId: string, input: Record<string, unknown>) {
    return vehicleRepository.update(vehicleId, input);
  },

  async assignVehicle(vehicleId: string, riderDbId: string) {
    // TODO: Validate vehicle is AVAILABLE
    // TODO: Validate rider is eligible
    return vehicleRepository.assignToRider(vehicleId, riderDbId);
  },

  async markForMaintenance(vehicleId: string) {
    // TODO: Verify not on active rental
    return vehicleRepository.update(vehicleId, { status: 'MAINTENANCE' });
  },

  /**
   * List vehicles with hub info, pagination, and active leases for admin panel.
   */
  async listAdminVehicles(params: { status?: string; hubId?: string; page: number; limit: number }) {
    const { status, hubId, page, limit } = params;
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (hubId) where.hubId = hubId;

    const [vehicles, total, hubs] = await Promise.all([
      db.vehicle.findMany({
        where,
        include: {
          hub: { select: { name: true, city: true } },
          returns: { orderBy: { createdAt: 'desc' }, take: 1 },
          leases: { where: { status: 'ACTIVE' }, take: 1, include: { rider: { select: { fullName: true, riderId: true } } } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.vehicle.count({ where }),
      db.hub.findMany({ select: { id: true, name: true } }),
    ]);

    return { vehicles, hubs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
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
    const hub = await db.hub.findUnique({ where: { id: hubId }, select: { id: true, name: true, isActive: true } });
    if (!hub) throw new Error('Hub not found');

    const vehicles = await db.vehicle.findMany({
      where: { hubId },
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

    const vehiclesData = vehicles.map((vehicle: any) => {
      const activeLease = vehicle.leases[0] || null;
      return {
        id: vehicle.id,
        vehicleId: vehicle.vehicleId,
        model: vehicle.model,
        licensePlate: vehicle.licensePlate,
        batteryLevel: vehicle.batteryLevel,
        status: vehicle.status,
        currentLease: activeLease ? {
          id: activeLease.id,
          status: activeLease.status,
          leaseDate: activeLease.leaseDate,
          startTime: activeLease.startTime,
          endTime: activeLease.endTime,
          rider: { id: activeLease.rider.id, riderId: activeLease.rider.riderId, name: activeLease.rider.fullName },
          shift: { id: activeLease.shift.id, name: activeLease.shift.name, startTime: activeLease.shift.startTime, endTime: activeLease.shift.endTime },
        } : null,
      };
    });

    const totalVehicles = vehicles.length;
    const availableVehicles = vehicles.filter((v: any) => v.status === 'AVAILABLE').length;

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
      },
      include: { hub: { select: { id: true, name: true } } },
    });
    if (!vehicle) throw new Error('Vehicle not found at this hub');
    return { id: vehicle.id, vehicleId: vehicle.vehicleId, vehicleNumber: vehicle.vehicleNumber, model: vehicle.model, status: vehicle.status, hub: vehicle.hub };
  },

  async getVehicleHistory(vehicleId: string) {
    return vehicleRepository.findVehicleHistory(vehicleId);
  },

  async bulkUpdateVehicles(ids: string[], action: string, value: string | undefined, actorId: string) {
    let updatedCount = 0;
    let auditAction = '';

    switch (action) {
      case 'changeStatus': {
        if (!value) throw new Error('Status value is required');
        const result = await vehicleRepository.bulkUpdateStatus(ids, { status: value });
        updatedCount = result.count;
        auditAction = 'vehicle.bulk_change_status';
        break;
      }
      case 'reassignHub': {
        if (!value) throw new Error('Hub ID is required');
        const result = await vehicleRepository.bulkUpdateStatus(ids, { hubId: value });
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

    return { count: updatedCount };
  },
};
