/**
 * Hubs module - Repository.
 *
 * Data access for hub locations, team leaders, and fleet assignments.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const hubRepository = {
  async findAll(includeInactive = false) {
    return db.hub.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async findById(hubId: string) {
    return db.hub.findUnique({ where: { id: hubId } });
  },

  async create(data: Prisma.HubCreateInput) {
    return db.hub.create({ data });
  },

  async update(hubId: string, data: Prisma.HubUpdateInput) {
    return db.hub.update({ where: { id: hubId }, data });
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
    return db.hub.delete({ where: { id: hubId } });
  },

  async bulkActivate(ids: string[]) {
    return db.hub.updateMany({ where: { id: { in: ids } }, data: { isActive: true } });
  },

  async bulkDeactivate(ids: string[]) {
    return db.hub.updateMany({ where: { id: { in: ids } }, data: { isActive: false } });
  },

  async bulkDelete(ids: string[]) {
    return db.hub.deleteMany({ where: { id: { in: ids } } });
  },
};
