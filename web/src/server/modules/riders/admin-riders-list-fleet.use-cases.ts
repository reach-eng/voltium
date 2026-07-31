import { db } from '@/lib/db';

/**
 * List fleet riders with vehicle and location data, filtered by hub/status/search/battery.
 */
export async function listFleet(filters: {
  hubId?: string;
  status?: string;
  search?: string;
  lowBattery?: boolean;
}) {
  const { hubId, status, search, lowBattery } = filters;
  const where: any = {};

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

  if (hubId) {
    where.AND = [
      ...(where.AND || []),
      {
        OR: [
          { pickupHub: hubId },
          { leases: { some: { status: 'ACTIVE', vehicle: { OR: [{ hubId }, { hub: { name: hubId } }] } } } },
        ],
      },
    ];
  }

  const riders = (await db.rider.findMany({
    where,
    select: {
      id: true,
      riderId: true,
      fullName: true,
      phone: true,
      lifecycleStatus: true,
      createdAt: true,
      pickupHub: true,
      teamLeader: true,
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
  })) as any[];

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
      teamLeader: r.teamLeader,
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

  return {
    riders: formatted,
    total: formatted.length,
    lowBatteryCount: formatted.filter((r) => r.batteryLevel < 20).length,
    withLocationCount: formatted.filter((r) => r.lastKnownLat && r.lastKnownLng).length,
  };
}
