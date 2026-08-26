/**
 * Rider module — Rewards, Earnings & Financial Queries
 *
 * Tier calculation, earnings aggregation/pagination, fcm rewards.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { getCachedRider } from '@/lib/server-cache';

export async function getRewards(riderDbId: string) {
  const rider = await getCachedRider(riderDbId, () =>
    db.rider.findUnique({
      where: { id: riderDbId },
      include: { wallet: { select: { paymentStreak: true } } },
    })
  );
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

  const totalPoints = aggregates._sum.points || 0;
  const tierBronze = 500;
  const tierSilver = 2000;
  const tierGold = 5000;
  
  let currentTier = 'Bronze';
  let nextTierThreshold = tierSilver;
  if (totalPoints >= tierSilver && totalPoints < tierGold) {
    currentTier = 'Silver';
    nextTierThreshold = tierGold;
  } else if (totalPoints >= tierGold) {
    currentTier = 'Gold';
    nextTierThreshold = tierGold;
  }
  
  const progress = Math.min(1.0, totalPoints / nextTierThreshold);
  const pointsToNext = Math.max(0, nextTierThreshold - totalPoints);

  return {
    rewards,
    totalPoints,
    thisMonthPoints,
    currentStreak: rider.wallet?.paymentStreak ?? 0,
    tier: { currentTier, nextTierThreshold, progress, pointsToNext, tierBronze, tierSilver, tierGold }
  };
}

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
  const where: Prisma.RiderEarningWhereInput = { riderId };
  if (startDate || endDate) {
    where.date = {
      ...(startDate ? { gte: new Date(startDate) } : {}),
      ...(endDate ? { lte: new Date(endDate) } : {}),
    };
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
    _sum: { amountInPaise: true, trips: true, distance: true, hoursOnline: true },
    _count: { id: true },
  });

  return {
    earnings,
    weeklySummary: {
      totalEarnings: (weeklySummary._sum?.amountInPaise ?? 0) / 100,
      totalTrips: weeklySummary._sum?.trips ?? 0,
      totalDistance: weeklySummary._sum?.distance ?? 0,
      totalHoursOnline: weeklySummary._sum?.hoursOnline ?? 0,
      daysWorked: weeklySummary._count?.id ?? 0,
    },
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

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
      amountInPaise: data.amount,
      trips: data.trips,
      distance: data.distance || null,
      hoursOnline: data.hoursOnline || null,
      notes: data.notes || null,
    },
  });
}
