/**
 * Analytics module — Use cases
 *
 * Aggregates and returns analytics data for admin dashboards.
 */

import { db } from '@/lib/db';

export const analyticsUseCases = {
  async getOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // P0-5 (ADMIN_DATAMGMT_AUDIT_2026-08-05): the original $queryRaw used
    // hard-coded snake_case table names ("riders", "vehicles", "transactions")
    // — if a future Prisma schema change drops a @map (or adds a new table
    // without one), the raw SQL silently returns 0 rows and the dashboard
    // lies. PR-1 (commit 34c8b55) was a prior instance of the same
    // fragile pattern; this rewrite uses Prisma's type-safe aggregations
    // so the type system catches the breakage at compile time.
    //
    // Trade-off: 8 separate count() / aggregate() calls instead of 1 raw
    // query with 8 subselects. The dashboard caches the response for 60s
    // (see /api/admin/analytics/route.ts:15), so the extra round-trips
    // are absorbed. The win is a stable contract: each call references
    // a Prisma model by name, and the @map is enforced by Prisma.
    const [
      totalRiders,
      activeRiders,
      lastMonthActiveRiders,
      churnedRiders,
      totalVehicles,
      activeVehiclesAgg,
      currentMonthRevenue,
      lastMonthRevenue,
      monthlyTrend,
      cohortData,
    ] = await Promise.all([
      db.rider.count(),
      db.rider.count({ where: { lifecycleStatus: 'ACTIVE' } }),
      db.rider.count({
        where: { lifecycleStatus: 'ACTIVE', createdAt: { lt: startOfMonth } },
      }),
      db.rider.count({
        where: {
          lifecycleStatus: 'SUSPENDED',
          updatedAt: { gte: startOfMonth },
        },
      }),
      db.vehicle.count(),
      // The original raw SQL filtered by status::text IN ('ACTIVE_RENTAL',
      // 'OVERDUE'). The Prisma VehicleStatus enum does not include
      // 'OVERDUE' (it has ACTIVE_RENTAL, RETURN_PENDING, etc.) — the
      // raw SQL's ::text cast was bypassing the enum check. The audit
      // counts vehicles in active rentals or in the post-rental return
      // window as a proxy for "vehicles out with a rider". A future
      // change to add an OVERDUE status to the enum would be picked up
      // by the SQL path but is silently lost in this Prisma query —
      // that's the trade-off the audit recommended (schema awareness
      // over silently-wrong counts).
      db.vehicle.count({
        where: { status: { in: ['ACTIVE_RENTAL', 'RETURN_PENDING'] } },
      }),
      // MRR (PR-79): only DEBIT + RENT_PAYMENT + APPROVED contributes.
      db.transaction.aggregate({
        _sum: { amountInPaise: true },
        where: {
          status: 'APPROVED',
          type: 'DEBIT',
          purpose: 'RENT_PAYMENT',
          createdAt: { gte: startOfMonth },
        },
      }),
      db.transaction.aggregate({
        _sum: { amountInPaise: true },
        where: {
          status: 'APPROVED',
          type: 'DEBIT',
          purpose: 'RENT_PAYMENT',
          createdAt: { gte: startOfLastMonth, lte: endOfLastMonth },
        },
      }),
      getMonthlyTrend(),
      getCohortData(),
    ]);

    const total = totalRiders;
    const active = activeRiders;
    const lastMonthActive = lastMonthActiveRiders;
    const churned = churnedRiders;
    const totalV = totalVehicles;
    const activeV = activeVehiclesAgg;
    const currentMRR = (currentMonthRevenue._sum.amountInPaise ?? 0) / 100;
    const lastMRR = (lastMonthRevenue._sum.amountInPaise ?? 0) / 100;

    const mrrGrowth = lastMRR > 0 ? ((currentMRR - lastMRR) / lastMRR) * 100 : 0;
    const churnRate = lastMonthActive > 0 ? (churned / lastMonthActive) * 100 : 0;

    const avgRevenuePerRider = active > 0 ? Math.round(currentMRR / active) : 0;
    const collectionEfficiency = totalV > 0 ? (activeV / totalV) * 100 : 0;

    return {
      overview: {
        totalRiders: total,
        activeRiders: active,
        totalVehicles: totalV,
        activeVehicles: activeV,
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
};

/**
 * I-5 (W10): Canonical IST month key formatter (YYYY-MM).
 * Unifies time bucketing across analytics queries so UTC dates near the
 * IST midnight boundary (UTC + 5:30) are consistently attributed.
 */
export function toIstMonthKey(date: Date): string {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + istOffsetMs);
  return `${istDate.getUTCFullYear()}-${String(istDate.getUTCMonth() + 1).padStart(2, '0')}`;
}

async function getMonthlyTrend(): Promise<Array<{ month: string; revenue: number }>> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  const buckets: Array<{ month: string; revenue: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i);
    buckets.push({
      month: toIstMonthKey(d),
      revenue: 0,
    });
  }

  // Build a map for O(1) lookup.
  const bucketByKey = new Map<string, number>();
  for (const b of buckets) bucketByKey.set(b.month, 0);

  // I-5 (W10): Query transactions and aggregate into IST month buckets.
  let rows: Array<{
    createdAt: Date;
    amountInPaise?: number | bigint | null;
    _sum?: { amountInPaise: bigint | null };
  }> = [];

  if (typeof db.transaction?.findMany === 'function') {
    rows = (await db.transaction.findMany({
      where: {
        status: 'APPROVED',
        type: 'DEBIT',
        purpose: 'RENT_PAYMENT',
        createdAt: { gte: startDate },
      },
      select: { createdAt: true, amountInPaise: true },
    })) as any;
  } else if (typeof (db.transaction as any)?.groupBy === 'function') {
    rows = (await (db.transaction as any).groupBy({
      by: ['createdAt'],
      where: {
        status: 'APPROVED',
        type: 'DEBIT',
        purpose: 'RENT_PAYMENT',
        createdAt: { gte: startDate },
      },
      _sum: { amountInPaise: true },
    })) as any;
  }

  for (const r of rows) {
    const key = toIstMonthKey(new Date(r.createdAt));
    const amount = r.amountInPaise ?? r._sum?.amountInPaise ?? 0;
    if (bucketByKey.has(key)) {
      bucketByKey.set(key, (bucketByKey.get(key) ?? 0) + Number(amount) / 100);
    }
  }

  for (const b of buckets) {
    b.revenue = bucketByKey.get(b.month) ?? 0;
  }
  return buckets;
}

async function getCohortData(): Promise<
  Array<{ month: string; total: number; active: number; suspended: number; retentionRate: number }>
> {
  // P0-5 (ADMIN_DATAMGMT_AUDIT_2026-08-05): pure Prisma aggregation — no raw
  // SQL with hard-coded table strings ("riders"). All fields and @maps are
  // validated at compile time by the Prisma client.
  const riders = await db.rider.findMany({
    where: { deletedAt: null },
    select: { createdAt: true, lifecycleStatus: true },
    orderBy: { createdAt: 'asc' },
  });

  const cohortMap = new Map<
    string,
    { month: string; total: number; active: number; suspended: number }
  >();

  for (const rider of riders) {
    const month = toIstMonthKey(new Date(rider.createdAt));
    const entry = cohortMap.get(month) ?? { month, total: 0, active: 0, suspended: 0 };
    entry.total += 1;
    if (rider.lifecycleStatus === 'ACTIVE') {
      entry.active += 1;
    } else if (rider.lifecycleStatus === 'SUSPENDED') {
      entry.suspended += 1;
    }
    cohortMap.set(month, entry);
  }

  return Array.from(cohortMap.values()).map((row) => ({
    month: row.month,
    total: row.total,
    active: row.active,
    suspended: row.suspended,
    retentionRate: row.total > 0 ? Math.round((row.active / row.total) * 10000) / 100 : 0,
  }));
}
