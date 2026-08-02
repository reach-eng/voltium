/**
 * Hubs module - Repository.
 *
 * Data access for hub locations, team leaders, and fleet assignments.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCachedHub, invalidateHubCache } from '@/lib/server-cache';

export const hubRepository = {
  async findAll(includeInactive = false) {
    return db.hub.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async findById(hubId: string) {
    return getCachedHub(hubId, () => db.hub.findUnique({ where: { id: hubId } }));
  },

  async create(data: Prisma.HubCreateInput) {
    return db.hub.create({ data });
  },

  async update(hubId: string, data: Prisma.HubUpdateInput) {
    const result = await db.hub.update({ where: { id: hubId }, data });
    invalidateHubCache(hubId);
    return result;
  },

  async getTeamLeaders(hubId?: string) {
    // teamLeader table in schema does not have hubId link
    return db.teamLeader.findMany({ orderBy: { name: 'asc' } });
  },

  async createTeamLeader(data: Prisma.TeamLeaderCreateInput) {
    return db.teamLeader.create({ data });
  },

  async findAllPaginated(page: number, limit: number) {
    const [hubs, total] = await Promise.all([
      db.hub.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vehicles: { select: { status: true } } },
      }),
      db.hub.count(),
    ]);
    return { hubs, total };
  },

  async getVehicleCount(hubId: string) {
    return db.vehicle.count({ where: { hubId } });
  },

  async hardDelete(hubId: string) {
    const result = await db.hub.delete({ where: { id: hubId } });
    invalidateHubCache(hubId);
    return result;
  },

  async bulkActivate(ids: string[]) {
    const result = await db.hub.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
    for (const id of ids) invalidateHubCache(id);
    return result;
  },

  async bulkDeactivate(ids: string[]) {
    const result = await db.hub.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
    for (const id of ids) invalidateHubCache(id);
    return result;
  },

  async bulkDelete(ids: string[]) {
    const result = await db.hub.deleteMany({ where: { id: { in: ids } } });
    for (const id of ids) invalidateHubCache(id);
    return result;
  },
};
