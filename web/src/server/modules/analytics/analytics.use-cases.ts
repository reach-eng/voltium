/**
 * Analytics module — Use cases
 *
 * Aggregates and returns analytics data for admin dashboards.
 */

import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { formatDateDDMMYYYY } from '@/lib/date-utils';
import { rawQuery } from '@/lib/raw-query';

export const analyticsUseCases = {
  async getOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

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
        (SELECT COUNT(*) FROM "vehicles" WHERE "status"::text IN ('ACTIVE_RENTAL', 'OVERDUE'))            AS active_vehicles,
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
      getMonthlyTrend(),
      getCohortData(),
    ]);

    const avgRevenuePerRider = activeRiders > 0 ? Math.round(currentMRR / activeRiders) : 0;
    const collectionEfficiency = totalVehicles > 0 ? (activeVehicles / totalVehicles) * 100 : 0;

    return {
      overview: {
        totalRiders,
        activeRiders,
        totalVehicles,
        activeVehicles,
        currentMRR,
        lastMRR,
        mrrGrowth: Math.round(mrrGrowth * 100) / 100,
        churnRate: Math.round(churnRate * 100) / 100,
        avgRevenuePerRider,
        collectionEfficiency: Math.round(collectionEfficiency * 100) / 100,
      },
      trend: monthlyTrend,
      cohorts: cohortData,
    };
  },

  /**
   * Admin home-dashboard stat cards. P1: canonical home of
   * `getDashboardStats` (moved verbatim from lib/services/dashboard.ts —
   * dual service layers collapsed; the lib file re-exports these).
   */
  async getDashboardStats() {
    const [
      totalRiders,
      activeRiders,
      totalVehicles,
      availableVehicles,
      walletBalanceResult,
      walletDepositResult,
      pendingTransactions,
      openTickets,
      totalHubs,
      pendingKyc,
      pendingGuarantor,
      pendingInfoRequired,
      totalAdmins,
      activeRentals,
    ] = await Promise.all([
      db.rider.count(),
      db.rider.count({ where: { lifecycleStatus: 'ACTIVE' } }),
      db.vehicle.count(),
      db.vehicle.count({ where: { status: 'AVAILABLE' } }),
      db.wallet.aggregate({ _sum: { balanceInPaise: true } }),
      db.wallet.aggregate({ _sum: { securityDepositInPaise: true } }),
      db.transaction.count({ where: { status: 'PENDING' } }),
      db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      db.hub.count(),
      db.kycProfile.count({ where: { status: { in: ['PENDING', 'SUBMITTED'] } } }),
      db.guarantor.count({ where: { status: 'PENDING' } }),
      db.kycProfile.count({ where: { status: 'INFO_REQUIRED' } }),
      db.admin.count({ where: { isActive: true } }),
      // PR-VER-2026-08-07 (RIDER_DASHBOARD P0-1): count ACTIVE rental leases,
      // not vehicles flagged ACTIVE_RENTAL/OVERDUE — the lease row is the
      // source of truth and matches the Operations overview endpoint.
      db.rentalLease.count({ where: { status: 'ACTIVE' } }),
    ]);

    const totalBalance = paiseToRupees(walletBalanceResult._sum.balanceInPaise || 0);
    const totalDeposits = paiseToRupees(walletDepositResult._sum.securityDepositInPaise || 0);

    return {
      totalRiders,
      activeRiders,
      totalVehicles,
      availableVehicles,
      totalBalance,
      totalDeposits,
      pendingTransactions,
      openTickets,
      activeRentals,
      totalHubs,
      pendingKyc,
      pendingGuarantor,
      pendingInfoRequired,
      totalAdmins,
    };
  },

  /**
   * 7-day revenue + rider trend. P1: moved verbatim from
   * lib/services/dashboard.ts (see getDashboardStats).
   */
  async getRevenueTrend(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const dailyMap = new Map<string, { revenue: number; riders: number }>();
    for (let i = 0; i < days; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      const key = date.toISOString().split('T')[0];
      dailyMap.set(key, { revenue: 0, riders: 0 });
    }

    // DEEP-AUDIT D-P1-7 (2026-08-08): raw SQL now goes through the typed
    // rawQuery wrapper. The `keys` argument is grep-able from CI; a Prisma
    // rename of any of these columns or the table fails the migration-
    // review CI step instead of silently returning 0 rows at runtime.
    const result = await rawQuery(
      Prisma.sql`SELECT
        DATE("createdAt") as date,
        SUM("amountInPaise") as revenue,
        COUNT(DISTINCT "riderId") as "riderCount"
      FROM "transactions"
      WHERE "createdAt" >= ${startDate} AND status = 'APPROVED' AND type = 'DEBIT' AND purpose = 'RENT_PAYMENT'
      GROUP BY DATE("createdAt")
      ORDER BY date ASC`,
      [
        'createdAt',
        'amountInPaise',
        'riderId',
        'transactions',
        'status',
        'type',
        'purpose',
      ] as const
    ) as Array<{ date: string; revenue: bigint; riderCount: bigint }>;

    for (const row of result) {
      const key = row.date;
      const entry = dailyMap.get(key);
      if (entry) {
        entry.revenue = Number(row.revenue) / 100;
        entry.riders = Number(row.riderCount);
      }
    }

    return Array.from(dailyMap.entries()).map(([date, data]) => ({
      date: formatDateDDMMYYYY(date),
      revenue: Math.round(data.revenue),
      riders: data.riders,
    }));
  },
};

async function getMonthlyTrend() {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const transactions = await db.transaction.findMany({
    where: {
      status: 'APPROVED',
      type: 'DEBIT',
      purpose: 'RENT_PAYMENT',
      createdAt: { gte: startDate },
    },
    select: {
      amountInPaise: true,
      createdAt: true,
    },
  });

  const monthMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    monthMap.set(key, 0);
  }

  for (const tx of transactions) {
    const d = new Date(tx.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (monthMap.has(key)) {
      monthMap.set(key, (monthMap.get(key) || 0) + tx.amountInPaise / 100);
    }
  }

  return Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, revenue]) => ({ month, revenue }));
}

async function getCohortData() {
  // PR-110: aggregate cohorts in database via SQL rather than loading all riders into Node memory
  const rows = await db.$queryRaw<
    Array<{ month: string; total: bigint; active: bigint; suspended: bigint }>
  >`
    SELECT 
      TO_CHAR("createdAt" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "lifecycleStatus" = 'ACTIVE')::bigint AS active,
      COUNT(*) FILTER (WHERE "lifecycleStatus" = 'SUSPENDED')::bigint AS suspended
    FROM "riders"
    WHERE "deletedAt" IS NULL
    GROUP BY TO_CHAR("createdAt" AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM')
    ORDER BY month ASC
  `;

  return rows.map((row: { month: string; total: bigint; active: bigint; suspended: bigint }) => {
    const total = Number(row.total);
    const active = Number(row.active);
    const suspended = Number(row.suspended);
    return {
      month: row.month,
      total,
      active,
      suspended,
      retentionRate: total > 0 ? Math.round((active / total) * 10000) / 100 : 0,
    };
  });
}
