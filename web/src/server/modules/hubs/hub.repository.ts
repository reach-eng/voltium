/**
 * Hubs module - Repository.
 *
 * Data access for hub locations, team leaders, and fleet assignments.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCachedHub, invalidateHubCache } from '@/lib/server-cache';

export const hubRepository = {
  // P1.5: soft-deleted hubs are invisible on every read path.
  async findAll(includeInactive = false) {
    return db.hub.findMany({
      where: includeInactive ? { deletedAt: null } : { isActive: true, deletedAt: null },
      orderBy: { name: 'asc' },
      // P1: bound — hubs are a small reference table, but never unbounded.
      take: 200,
    });
  },

  async findById(hubId: string) {
    return getCachedHub(hubId, () =>
      db.hub.findFirst({ where: { id: hubId, deletedAt: null } })
    );
  },

  async create(data: Prisma.HubCreateInput) {
    return db.hub.create({ data });
  },

  async update(hubId: string, data: Prisma.HubUpdateInput) {
    const result = await db.hub.update({ where: { id: hubId }, data });
    invalidateHubCache(hubId);
    return result;
  },

  // P1.8: TeamLeader now has a hubId FK — a hub-scoped lookup returns only
  // the team leaders belonging to that hub; without a hubId, all active ones.
  async getTeamLeaders(hubId?: string) {
    return db.teamLeader.findMany({
      where: hubId ? { hubId } : { isActive: true },
      orderBy: { name: 'asc' },
    });
  },

  async createTeamLeader(data: Prisma.TeamLeaderCreateInput) {
    return db.teamLeader.create({ data });
  },

  // P1.5/P3.11: findMany and count must share the same where so the paginated
  // total never counts hubs the list itself hides.
  async findAllPaginated(page: number, limit: number) {
    const [hubs, total] = await Promise.all([
      db.hub.findMany({
        where: { deletedAt: null },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { vehicles: { select: { status: true } } },
      }),
      db.hub.count({ where: { deletedAt: null } }),
    ]);
    return { hubs, total };
  },

  async getVehicleCount(hubId: string) {
    return db.vehicle.count({ where: { hubId } });
  },

  // P1.5: soft delete — hidden from all reads, row + audit trail retained.
  async softDelete(hubId: string) {
    const result = await db.hub.update({
      where: { id: hubId },
      data: { deletedAt: new Date(), isActive: false },
    });
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

  async bulkSoftDelete(ids: string[]) {
    const result = await db.hub.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });
    for (const id of ids) invalidateHubCache(id);
    return result;
  },
};
