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
    const hubsWithBreakdown = hubs.map((hub) => {
      const breakdown = {
        available: 0,
        assigned: 0,
        maintenance: 0,
        retired: 0,
        lost: 0,
        total: hub.vehicles?.length || 0,
      };
      // P2.13: enumerate the REAL VehicleStatus enum. The old code checked
      // for 'RENTED' (not a status) and silently DROPPED ACTIVE_RENTAL /
      // RESERVED / RETURN_PENDING vehicles from every bucket — a hub with 10
      // active rentals showed "0 assigned".
      hub.vehicles.forEach((v) => {
        const s = v.status as string;
        switch (s) {
          case 'AVAILABLE':
            breakdown.available++;
            break;
          case 'ASSIGNED':
          case 'RESERVED':
          case 'ACTIVE_RENTAL':
          case 'RETURN_PENDING':
            breakdown.assigned++;
            break;
          case 'MAINTENANCE':
            breakdown.maintenance++;
            break;
          case 'RETIRED':
            breakdown.retired++;
            break;
          case 'LOST':
            breakdown.lost++;
            break;
        }
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

  // P2.6/P3.16: the audit log stored the raw update payload — a snapshot, not
  // a diff. Pre-fetch the row, compute which fields actually changed, and log
  // before/after so a regulator can see exactly what changed without
  // comparing against a previous DB dump.
  async updateHub(hubId: string, input: Prisma.HubUpdateInput, actorId: string) {
    // Read `before` FRESH (uncached) — a stale getCachedHub row would make
    // the audit diff lie about what actually changed.
    const before = await db.hub.findFirst({ where: { id: hubId, deletedAt: null } });
    const hub = await hubRepository.update(hubId, input);
    const inputAsRecord = input as unknown as Record<string, unknown>;
    const changedFields = before
      ? Object.keys(inputAsRecord).filter(
          (k) => (before as Record<string, unknown>)[k] !== inputAsRecord[k]
        )
      : Object.keys(inputAsRecord);
    const pick = (row: Record<string, unknown> | null | undefined, keys: string[]) => {
      if (!row) return {};
      const out: Record<string, unknown> = {};
      for (const k of keys) out[k] = row[k];
      return out;
    };
    createAuditLog({
      actorId,
      action: 'hub.update',
      entity: 'hub',
      entityId: hubId,
      details: {
        changedFields,
        before: pick(before as Record<string, unknown> | null, changedFields),
        after: pick(hub as unknown as Record<string, unknown>, changedFields),
      },
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
    // P1.5: soft delete — the row survives for audit/compliance.
    await hubRepository.softDelete(hubId);
    createAuditLog({ actorId, action: 'hub.delete', entity: 'hub', entityId: hubId }).catch(
      () => {}
    );
  },

  async listTeamLeaders(hubId?: string) {
    return hubRepository.getTeamLeaders(hubId);
  },

  async createTeamLeader(input: Prisma.TeamLeaderCreateInput) {
    return hubRepository.createTeamLeader(input);
  },

  // P2.20/P3.20: ONE audit log per bulk action with { ids, count } — the old
  // loop wrote N indistinguishable "hub.activate" entries, so bulk and
  // per-hub clicks were impossible to tell apart.
  async bulkActivate(ids: string[], actorId: string) {
    const result = await hubRepository.bulkActivate(ids);
    createAuditLog({
      actorId,
      action: 'hub.bulk_activate',
      entity: 'hub',
      entityId: 'multiple',
      details: { ids, count: result.count },
    }).catch(() => {});
    return { count: result.count };
  },

  async bulkDeactivate(ids: string[], actorId: string) {
    const result = await hubRepository.bulkDeactivate(ids);
    createAuditLog({
      actorId,
      action: 'hub.bulk_deactivate',
      entity: 'hub',
      entityId: 'multiple',
      details: { ids, count: result.count },
    }).catch(() => {});
    return { count: result.count };
  },

  async bulkDelete(ids: string[], actorId: string) {
    const hubsWithVehicles = await db.hub.findMany({
      where: { id: { in: ids }, deletedAt: null, vehicles: { some: {} } },
      select: { id: true },
    });
    if (hubsWithVehicles.length > 0) {
      throw new Error(
        `Cannot delete ${hubsWithVehicles.length} hub(s) with vehicles still assigned. Reassign them first.`
      );
    }
    try {
      const result = await hubRepository.bulkSoftDelete(ids);
      createAuditLog({
        actorId,
        action: 'hub.bulk_delete',
        entity: 'hub',
        entityId: 'multiple',
        details: { ids, count: result.count },
      }).catch(() => {});
      return { count: result.count };
    } catch (err) {
      // P2.9: the vehicle check is non-atomic, but the FK (onDelete: Restrict)
      // is the real guard — surface its constraint violation as a friendly
      // conflict instead of a 500.
      if ((err as { code?: string })?.code === 'P2003') {
        throw new Error(
          'Cannot delete hub(s): a vehicle was assigned between the check and the delete. Reassign and retry.'
        );
      }
      throw err;
    }
  },
};
