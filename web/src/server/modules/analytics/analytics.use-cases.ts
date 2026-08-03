/**
 * Analytics module — Use cases
 *
 * Aggregates and returns analytics data for admin dashboards.
 */

import { db } from '@/lib/db';
import type { AnalyticsDashboard } from './analytics.types';

export const analyticsUseCases = {
  async getDashboard(period: string): Promise<AnalyticsDashboard> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(period.replace('d', '').replace('y', '365')));

    // Single raw query replaces 4 separate Prisma count() round-trips.
    // Table names are the snake_case @map targets (riders, vehicles), not
    // the Prisma model names (Rider, Vehicle) — see prisma/schema.prisma
    // @@map declarations and PR-1 (34c8b55) for the prior fix.
    const [counts] = await db.$queryRaw<
      { total_riders: bigint; active_riders: bigint; total_vehicles: bigint }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM "riders")                                       AS total_riders,
        (SELECT COUNT(*) FROM "riders" WHERE "lifecycleStatus" = 'ACTIVE')   AS active_riders,
        (SELECT COUNT(*) FROM "vehicles")                                     AS total_vehicles
    `;

    const totalRiders = Number(counts.total_riders);
    const activeRiders = Number(counts.active_riders);
    const totalVehicles = Number(counts.total_vehicles);
    const activeRentals = activeRiders; // matches original logic

    return {
      revenue: {
        mrr: 0,
        previousMrr: 0,
        mrrGrowth: 0,
        pendingPayments: 0,
        totalCollected: 0,
      },
      riders: {
        totalRiders,
        activeRiders,
        newRidersThisMonth: 0,
        churnRate: 0,
        averageTenureDays: 0,
      },
      fleet: {
        totalVehicles,
        availableVehicles: totalVehicles - activeRentals,
        activeRentals,
        maintenanceVehicles: 0,
        utilizationRate: activeRentals / (totalVehicles || 1),
      },
      period: { start: startDate, end: endDate },
    };
  },

  /**
   * Full analytics overview with MRR, trends, and cohort data.
   */
  async getOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
    twelveMonthsAgo.setDate(1);

    // Single raw query replaces 5 separate Prisma count/aggregate round-trips.
    // Uses snake_case table names (riders, vehicles, transactions) and the
    // renamed amountInPaise column. See PR-1 (34c8b55) for the original
    // snake_case fix and the amount -> amountInPaise rename migration.
    const [ridersAndVehicles] = await db.$queryRaw<
      {
        total_riders: bigint;
        active_riders: bigint;
        last_month_active: bigint;
        churned_this_month: bigint;
        total_vehicles: bigint;
        active_vehicles: bigint;
        current_month_revenue: bigint | null;
        last_month_revenue: bigint | null;
      }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM "riders")                                                            AS total_riders,
        (SELECT COUNT(*) FROM "riders" WHERE "lifecycleStatus" = 'ACTIVE')                        AS active_riders,
        (SELECT COUNT(*) FROM "riders" WHERE "lifecycleStatus" = 'ACTIVE'
          AND "createdAt" < ${startOfMonth})                                                       AS last_month_active,
        (SELECT COUNT(*) FROM "riders" WHERE "lifecycleStatus" = 'SUSPENDED'
          AND "updatedAt" >= ${startOfMonth})                                                      AS churned_this_month,
        (SELECT COUNT(*) FROM "vehicles")                                                          AS total_vehicles,
        (SELECT COUNT(*) FROM "vehicles" WHERE status = 'ACTIVE_RENTAL')                          AS active_vehicles,
        -- PR-79: MRR is the sum of RENT_PAYMENT debits only.
        -- The previous filter summed ALL APPROVED transactions,
        -- which inflated MRR with deposits (CREDIT), reversals,
        -- admin adjustments, and sign-up bonuses. Dashboard
        -- now reports real revenue.
        (SELECT SUM("amountInPaise") FROM "transactions"
          WHERE status = 'APPROVED' AND "type" = 'DEBIT'
            AND "purpose" = 'RENT_PAYMENT'
            AND "createdAt" >= ${startOfMonth})                                                   AS current_month_revenue,
        (SELECT SUM("amountInPaise") FROM "transactions"
          WHERE status = 'APPROVED' AND "type" = 'DEBIT'
            AND "purpose" = 'RENT_PAYMENT'
            AND "createdAt" >= ${startOfLastMonth}
            AND "createdAt" <= ${endOfLastMonth})                                                  AS last_month_revenue
    `;

    const totalRiders = Number(ridersAndVehicles.total_riders);
    const activeRiders = Number(ridersAndVehicles.active_riders);
    const lastMonthActiveRiders = Number(ridersAndVehicles.last_month_active);
    const churnedRiders = Number(ridersAndVehicles.churned_this_month);
    const totalVehicles = Number(ridersAndVehicles.total_vehicles);
    const activeVehicles = Number(ridersAndVehicles.active_vehicles);
    const currentMRR = Number(ridersAndVehicles.current_month_revenue ?? 0) / 100;
    const lastMRR = Number(ridersAndVehicles.last_month_revenue ?? 0) / 100;

    const mrrGrowth = lastMRR > 0 ? ((currentMRR - lastMRR) / lastMRR) * 100 : 0;
    const churnRate = lastMonthActiveRiders > 0 ? (churnedRiders / lastMonthActiveRiders) * 100 : 0;

    const [monthlyTrend, cohortData] = await Promise.all([
      getMonthlyTrend(twelveMonthsAgo),
      getCohortData(),
    ]);

    return {
      overview: {
        totalRiders,
        activeRiders,
        currentMRR,
        mrrGrowth: Math.round(mrrGrowth * 100) / 100,
        avgRevenuePerRider:
          activeRiders > 0 ? Math.round((currentMRR / activeRiders) * 100) / 100 : 0,
        churnRate: Math.round(churnRate * 100) / 100,
        collectionEfficiency:
          activeVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 10000) / 100 : 0,
        totalVehicles,
        activeVehicles,
      },
      trend: monthlyTrend,
      cohorts: cohortData,
    };
  },
};

async function getMonthlyTrend(startDate: Date) {
  // `amount` was renamed to `amountInPaise` in migration 20260729150000.
  // The value is in paise (integer); divide by 100 only at the response
  // boundary to keep aggregation math exact.
  // PR-79: same RENT_PAYMENT filter as MRR — only real rent revenue
  // is in the trend, not deposits or admin credits.
  const transactions = await db.transaction.findMany({
    where: {
      status: 'APPROVED',
      type: 'DEBIT',
      purpose: 'RENT_PAYMENT',
      createdAt: { gte: startDate },
    },
    select: { amountInPaise: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const monthlyData: Record<string, number> = {};
  transactions.forEach((t: { amountInPaise: number; createdAt: Date }) => {
    const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = (monthlyData[key] || 0) + t.amountInPaise / 100;
  });

  return Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));
}

async function getCohortData() {
  const riders = await db.rider.findMany({
    select: { id: true, createdAt: true, lifecycleStatus: true, updatedAt: true },
  });
  const cohorts: Record<string, { total: number; active: number; suspended: number }> = {};

  riders.forEach((r: { id: string; createdAt: Date; lifecycleStatus: string; updatedAt: Date }) => {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!cohorts[key]) cohorts[key] = { total: 0, active: 0, suspended: 0 };
    cohorts[key].total++;
    if (r.lifecycleStatus === 'ACTIVE') cohorts[key].active++;
    if (r.lifecycleStatus === 'SUSPENDED') cohorts[key].suspended++;
  });

  return Object.entries(cohorts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, data]) => ({
      month,
      ...data,
      retentionRate: data.total > 0 ? Math.round((data.active / data.total) * 10000) / 100 : 0,
    }));
}

