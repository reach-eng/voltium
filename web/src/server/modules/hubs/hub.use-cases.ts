import { hubRepository } from './hub.repository';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { Prisma } from '@prisma/client';

export const hubUseCases = {
  async listHubs() {
    return hubRepository.findAll();
  },

  async listAdminHubs(page: number, limit: number) {
    const { hubs, total } = await hubRepository.findAllPaginated(page, limit);
    const hubsWithBreakdown = hubs.map((hub: any) => {
      const breakdown = {
        available: 0,
        assigned: 0,
        maintenance: 0,
        retired: 0,
        total: hub.vehicles?.length || 0,
      };
      hub.vehicles.forEach((v: any) => {
        const s = v.status.toUpperCase();
        if (s === 'AVAILABLE') breakdown.available++;
        else if (s === 'ASSIGNED' || s === 'RENTED') breakdown.assigned++;
        else if (s === 'MAINTENANCE') breakdown.maintenance++;
        else if (s === 'RETIRED') breakdown.retired++;
      });
      const { vehicles, ...rest } = hub;
      return { ...rest, _count: { vehicles: breakdown.total }, vehicleBreakdown: breakdown };
    });
    return {
      hubs: hubsWithBreakdown,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getHub(hubId: string) {
    return hubRepository.findById(hubId);
  },

  async createHub(input: Prisma.HubCreateInput, actorId: string) {
    const hub = await hubRepository.create(input);
    createAuditLog({
      actorId,
      action: 'hub.create',
      entity: 'hub',
      entityId: hub.id,
      details: { name: input.name },
    }).catch(() => {});
    return hub;
  },

  async updateHub(hubId: string, input: Prisma.HubUpdateInput, actorId: string) {
    const hub = await hubRepository.update(hubId, input);
    createAuditLog({
      actorId,
      action: 'hub.update',
      entity: 'hub',
      entityId: hubId,
      details: input as any,
    }).catch(() => {});
    return hub;
  },

  async deleteHub(hubId: string, actorId: string) {
    const vehicleCount = await hubRepository.getVehicleCount(hubId);
    if (vehicleCount > 0) {
      throw new Error(
        `Cannot delete hub: ${vehicleCount} vehicle(s) still assigned. Reassign them first.`
      );
    }
    await hubRepository.hardDelete(hubId);
    createAuditLog({ actorId, action: 'hub.delete', entity: 'hub', entityId: hubId }).catch(
      () => {}
    );
  },

  async listTeamLeaders(hubId?: string) {
    return hubRepository.getTeamLeaders(hubId);
  },

  async createTeamLeader(input: Record<string, unknown>) {
    return hubRepository.createTeamLeader(input as any);
  },

  async bulkActivate(ids: string[], actorId: string) {
    const result = await hubRepository.bulkActivate(ids);
    for (const id of ids) {
      createAuditLog({ actorId, action: 'hub.activate', entity: 'hub', entityId: id }).catch(
        () => {}
      );
    }
    return { count: result.count };
  },

  async bulkDeactivate(ids: string[], actorId: string) {
    const result = await hubRepository.bulkDeactivate(ids);
    for (const id of ids) {
      createAuditLog({ actorId, action: 'hub.deactivate', entity: 'hub', entityId: id }).catch(
        () => {}
      );
    }
    return { count: result.count };
  },

  async bulkDelete(ids: string[], actorId: string) {
    const hubsWithVehicles = await db.hub.findMany({
      where: { id: { in: ids }, vehicles: { some: {} } },
      select: { id: true },
    });
    if (hubsWithVehicles.length > 0) {
      throw new Error(
        `Cannot delete ${hubsWithVehicles.length} hub(s) with vehicles still assigned. Reassign them first.`
      );
    }
    const result = await hubRepository.bulkDelete(ids);
    for (const id of ids) {
      createAuditLog({ actorId, action: 'hub.delete', entity: 'hub', entityId: id }).catch(
        () => {}
      );
    }
    return { count: result.count };
  },
};
