/**
 * Admin Rider Fleet module — Use cases (P1 split from admin-riders.use-cases).
 *
 * Fleet-map/export listing. Extracted verbatim (bounded pagination included)
 * as the first step of decomposing the admin-riders god module; callers keep
 * using `adminRiderUseCases.listFleet` (delegation), new code may import
 * `fleetUseCases` directly.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export interface FleetFilters {
  hubId?: string;
  status?: string;
  search?: string;
  lowBattery?: boolean;
  page?: number;
  limit?: number;
}

export const fleetUseCases = {
  async listFleet(filters: FleetFilters) {
    const { hubId, status, search, lowBattery } = filters;
    // P0 fix 2026-09-03: the old query had no take/skip — at 10k riders it
    // loaded the whole table + N+1 lease subqueries sorted on unindexed
    // lastLocationAt. Bound it: default 100, max 200 per page.
    const limit = Math.min(Math.max(filters.limit ?? 100, 1), 200);
    const page = Math.max(filters.page ?? 1, 1);
    const skip = (page - 1) * limit;
    const where: Prisma.RiderWhereInput = {};

    if (status && status !== 'ALL') {
      if (status === 'active') {
        where.lifecycleStatus = 'ACTIVE';
      } else if (status === 'idle') {
        where.lifecycleStatus = 'PROFILE_SUBMITTED';
      } else if (status === 'offline') {
        where.OR = [
          { lifecycleStatus: 'SUSPENDED' },
          { lifecycleStatus: { notIn: ['ACTIVE', 'PROFILE_SUBMITTED'] } },
        ];
      }
    }

    if (search) {
      where.OR = [
        ...(where.OR || []),
        { fullName: { contains: search } },
        { phone: { contains: search } },
        { riderId: { contains: search } },
      ];
    }

    if (lowBattery) {
      where.batteryLevel = { lt: 20 };
    }

    const riders = await db.rider.findMany({
      where,
      select: {
        id: true,
        riderId: true,
        fullName: true,
        phone: true,
        lifecycleStatus: true,
        createdAt: true,
        pickupHub: true,
        teamLeaderId: true,
        currentPlan: true,
        planStartDate: true,
        planEndDate: true,
        lastKnownLat: true,
        lastKnownLng: true,
        lastLocationAt: true,
        batteryLevel: true,
        leases: {
          where: { status: 'ACTIVE' },
          take: 1,
          select: {
            vehicle: {
              select: {
                id: true,
                vehicleNumber: true,
                model: true,
                batteryLevel: true,
                status: true,
                hub: { select: { name: true, city: true } },
              },
            },
          },
        },
      },
      orderBy: { lastLocationAt: 'desc' },
      skip,
      take: limit + 1, // +1 to compute hasMore without a second COUNT
    });

    const formatted = riders.map((r) => {
      const lease = r.leases[0];
      return {
        id: r.id,
        riderId: r.riderId,
        fullName: r.fullName,
        phone: r.phone,
        createdAt: r.createdAt,
        lifecycleStatus: r.lifecycleStatus,
        pickupHub: r.pickupHub,
        teamLeaderId: r.teamLeaderId,
        currentPlan: r.currentPlan,
        planStartDate: r.planStartDate,
        planEndDate: r.planEndDate,
        lastKnownLat: r.lastKnownLat,
        lastKnownLng: r.lastKnownLng,
        lastLocationAt: r.lastLocationAt,
        batteryLevel: r.batteryLevel,
        vehicle: lease?.vehicle
          ? {
              id: lease.vehicle.id,
              vehicleNumber: lease.vehicle.vehicleNumber,
              model: lease.vehicle.model,
              batteryLevel: lease.vehicle.batteryLevel,
              status: lease.vehicle.status,
              hubName: lease.vehicle.hub?.name,
              hubCity: lease.vehicle.hub?.city,
            }
          : null,
      };
    });

    let filtered = formatted;
    if (hubId) {
      filtered = filtered.filter((r) => r.pickupHub === hubId || r.vehicle?.hubName === hubId);
    }

    // NOTE: hubId is still filtered in Node on the bounded page (legacy
    // pickupHub string vs vehicle hub name mismatch — pushing it into the DB
    // where-clause needs the D-P2-4 FK migration). The DB query itself is now
    // bounded, so the worst case is one page, not the whole table.
    const hasMore = riders.length > limit;
    const pageRows = hasMore ? filtered.slice(0, limit) : filtered;
    return {
      riders: pageRows,
      total: pageRows.length,
      page,
      limit,
      hasMore,
      lowBatteryCount: pageRows.filter((r) => r.batteryLevel < 20).length,
      withLocationCount: pageRows.filter((r) => r.lastKnownLat && r.lastKnownLng).length,
    };
  },
};
