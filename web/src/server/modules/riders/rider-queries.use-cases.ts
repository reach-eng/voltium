/**
 * Rider — Queries
 *
 * Get rider profile, dashboard, rewards, earnings list, and create earning records.
 */

import { db } from '@/lib/db';
import { flattenRider } from '@/lib/flatten-rider';

/**
 * Gets full rider profile with all relations.
 */
export async function getProfile(riderDbId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    include: {
      kycProfile: true,
      wallet: true,
      guarantor: true,
      vehicleReturns: true,
      vehicle: { select: { vehicleNumber: true, model: true } },
    },
  });
  if (!rider) return null;

  const [unreadNotificationCount, rewardAggregates] = await Promise.all([
    db.notification.count({ where: { riderId: rider.id, isRead: false } }),
    db.reward.aggregate({ where: { riderId: rider.id }, _sum: { points: true } }),
  ]);

  const flatRider = flattenRider(rider);
  let assignedVehicleNumber = flatRider.assignedVehicle;
  let vehicleModel: string | null = null;
  if (rider.vehicle) {
    assignedVehicleNumber = rider.vehicle.vehicleNumber;
    vehicleModel = rider.vehicle.model;
  } else if (flatRider.assignedVehicle) {
    const v = await db.vehicle.findUnique({ where: { vehicleId: flatRider.assignedVehicle } });
    if (v) {
      assignedVehicleNumber = v.vehicleNumber;
      vehicleModel = v.model;
    }
  }
  flatRider.assignedVehicle = assignedVehicleNumber;

  return {
    ...flatRider,
    vehicleModel,
    referralCode: rider.referralCode,
    unreadNotificationCount,
    totalRewardPoints: rewardAggregates._sum.points || 0,
  };
}

/**
 * Get full dashboard data for a rider.
 */
export async function getDashboard(riderDbId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: {
      id: true,
      riderId: true,
      fullName: true,
      phone: true,
      lifecycleStatus: true,
      currentPlan: true,
      planStartDate: true,
      planEndDate: true,
      planRejectionReason: true,
      referralCode: true,
      pickupHub: true,
      teamLeader: true,
      emergencyContact: true,
      pickupPhotoFront: true,
      pickupPhotoBack: true,
      pickupPhotoLeft: true,
      pickupPhotoRight: true,
      pickupPhotoWithVehicle: true,
      kycProfile: {
        select: {
          status: true,
          profilePhoto: true,
          riderPhoto: true,
          signature: true,
          aadhaarFront: true,
          aadhaarBack: true,
          aadhaarNumber: true,
          panCard: true,
          panNumber: true,
          bankName: true,
          accountNumber: true,
          ifscCode: true,
          rejectionReason: true,
          editableFields: true,
        },
      },
      wallet: {
        select: {
          balanceInPaise: true,
          securityDeposit: true,
          depositStatus: true,
          paymentStreak: true,
        },
      },
      guarantor: {
        select: {
          status: true,
          name: true,
          relation: true,
          dob: true,
          phone: true,
          signature: true,
        },
      },
      vehicleReturns: { select: { id: true, status: true } },
      depositRecord: true,
      vehicle: {
        select: {
          id: true,
          vehicleId: true,
          vehicleNumber: true,
          model: true,
          batteryLevel: true,
          hub: { select: { id: true, name: true, location: true } },
        },
      },
    },
  });
  if (!rider) return null;

  const unreadNotifications = await db.notification.count({
    where: { riderId: riderDbId, isRead: false },
  });

  let referralCode = rider.referralCode;
  if (!referralCode) {
    const namePart = (rider.fullName || 'VOLT').slice(0, 4).toUpperCase();
    const idPart = (rider.riderId || '0000000000').slice(-6);
    referralCode = `${namePart}${idPart}`;
  }

  let planDaysRemaining: number | null = null;
  if (
    (rider.lifecycleStatus === 'ACTIVE' ||
      rider.lifecycleStatus === 'PLAN_SELECTED' ||
      rider.lifecycleStatus === 'PICKUP_SCHEDULED') &&
    rider.planEndDate
  ) {
    const diffMs = rider.planEndDate.getTime() - Date.now();
    planDaysRemaining = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  }

  let signedRider: any = null;
  try {
    const flatRider = flattenRider(rider as any);
    flatRider.assignedVehicle = rider.vehicle?.vehicleNumber || flatRider.assignedVehicle;
    
    const { signRiderUrls } = await import('@/lib/sign-rider');
    signedRider = await signRiderUrls(flatRider);
  } catch {
    signedRider = { id: rider.id, fullName: rider.fullName, riderId: rider.riderId };
  }

  return {
    rider: signedRider,
    referralCode,
    unreadNotifications,
    todayStats: { distance: 0, power: 0, speed: 0, battery: 0 },
    planDaysRemaining,
  };
}

/**
 * Get rewards for a rider.
 */
export async function getRewards(riderDbId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    include: { wallet: { select: { paymentStreak: true } } },
  });
  if (!rider) return null;

  const [rewards, aggregates] = await Promise.all([
    db.reward.findMany({
      where: { riderId: riderDbId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, title: true, points: true, createdAt: true },
    }),
    db.reward.aggregate({ where: { riderId: riderDbId }, _sum: { points: true } }),
  ]);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthRewards = rewards.filter(
    (r: { createdAt: Date | string }) => new Date(r.createdAt) >= monthStart
  );
  const thisMonthPoints = thisMonthRewards.reduce(
    (sum: number, r: { points: number }) => sum + r.points,
    0
  );

  return {
    rewards,
    totalPoints: aggregates._sum.points || 0,
    thisMonthPoints,
    currentStreak: rider.wallet?.paymentStreak ?? 0,
  };
}

/**
 * List earnings for a rider with pagination and filters.
 */
export async function listEarnings(
  riderId: string,
  filters: {
    startDate?: string;
    endDate?: string;
    platform?: string;
    page: number;
    limit: number;
  }
) {
  const { startDate, endDate, platform, page, limit } = filters;
  const where: Record<string, unknown> = { riderId };
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as any).gte = new Date(startDate);
    if (endDate) (where.date as any).lte = new Date(endDate);
  }
  if (platform) where.platform = platform;

  const [earnings, total] = await Promise.all([
    db.riderEarning.findMany({
      where,
      orderBy: { date: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.riderEarning.count({ where }),
  ]);

  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weeklySummary = await db.riderEarning.aggregate({
    where: { riderId, date: { gte: startOfWeek } },
    _sum: { amount: true, trips: true, distance: true, hoursOnline: true },
    _count: { id: true },
  });

  return {
    earnings,
    weeklySummary: {
      totalEarnings: weeklySummary._sum.amount ?? 0,
      totalTrips: weeklySummary._sum.trips ?? 0,
      totalDistance: weeklySummary._sum.distance ?? 0,
      totalHoursOnline: weeklySummary._sum.hoursOnline ?? 0,
      daysWorked: weeklySummary._count.id ?? 0,
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

/**
 * Create an earning record for a rider.
 */
export async function createEarning(
  riderId: string,
  data: {
    date: string;
    platform?: string;
    amount: number;
    trips: number;
    distance?: number;
    hoursOnline?: number;
    notes?: string;
  }
) {
  return db.riderEarning.create({
    data: {
      riderId,
      date: new Date(data.date),
      platform: data.platform || null,
      amount: data.amount,
      trips: data.trips,
      distance: data.distance || null,
      hoursOnline: data.hoursOnline || null,
      notes: data.notes || null,
    },
  });
}
