/**
 * Admin Riders — Fleet & Device Tracking
 *
 * Fleet overview, device data (contacts, call logs, locations), and security flags.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { invalidateRiderCache } from '@/lib/server-cache';

export async function listFleetRiders(filters: {
  hubId?: string;
  status?: string;
  search?: string;
  lowBattery?: boolean;
}) {
  const { hubId, status, search, lowBattery } = filters;
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

  return {
    riders: filtered,
    total: filtered.length,
    lowBatteryCount: filtered.filter((r) => r.batteryLevel < 20).length,
    withLocationCount: filtered.filter((r) => r.lastKnownLat && r.lastKnownLng).length,
  };
}

export async function getRiderDeviceData(riderId: string, type: string = 'all') {
  const rider = await db.rider.findUnique({
    where: { id: riderId },
    select: {
      isAdminLocked: true,
      isUninstallBlocked: true,
      isLocationMandatory: true,
      isAppsControlRestricted: true,
    },
  });

  const results: {
    rider: typeof rider;
    contacts?: Awaited<ReturnType<typeof db.userContact.findMany>>;
    callLogs?: Awaited<ReturnType<typeof db.userCallLog.findMany>>;
    locations?: Awaited<ReturnType<typeof db.userLocation.findMany>>;
  } = { rider };

  if (type === 'CONTACTS' || type === 'all') {
    results.contacts = await db.userContact.findMany({
      where: { riderId },
      orderBy: { name: 'asc' },
    });
  }
  if (type === 'CALL_LOGS' || type === 'all') {
    results.callLogs = await db.userCallLog.findMany({
      where: { riderId },
      orderBy: { timestamp: 'desc' },
      take: 50,
    });
  }
  if (type === 'LOCATION' || type === 'all') {
    results.locations = await db.userLocation.findMany({
      where: { riderId },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });
  }

  return results;
}

export async function updateRiderSecurityFlags(riderId: string, data: Record<string, unknown>, actorId: string) {
  const updateData = { ...data };
  if (updateData.lockPassword && typeof updateData.lockPassword === 'string') {
    const { hashPassword } = await import('@/lib/password');
    updateData.lockPassword = await hashPassword(updateData.lockPassword);
  }
  await db.rider.update({ where: { id: riderId }, data: updateData });
  invalidateRiderCache(riderId);
  await createAuditLog({
    action: 'system.config_change',
    entityId: riderId,
    entity: 'rider',
    actorId,
    details: (({ lockPassword, ...safe }) => safe)(data),
  });
}
