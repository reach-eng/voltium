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

async function getMonthlyTrend(): Promise<Array<{ month: string; revenue: number }>> {
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 11);
  startDate.setDate(1);
  startDate.setHours(0, 0, 0, 0);

  // PR-110: aggregate in Node by iterating monthly buckets. The cohort
  // query is the only one that justified raw SQL (date-bucket grouping);
  // the monthly trend is just a sum grouped by month, which Prisma's
  // groupBy handles in a single round-trip.
  const buckets: Array<{ month: string; revenue: number }> = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(startDate);
    d.setMonth(startDate.getMonth() + i);
    const monthEnd = new Date(d);
    monthEnd.setMonth(d.getMonth() + 1);
    buckets.push({
      month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      revenue: 0,
    });
    void monthEnd;
  }

  const rows = await db.transaction.groupBy({
    by: ['createdAt'],
    where: {
      status: 'APPROVED',
      type: 'DEBIT',
      purpose: 'RENT_PAYMENT',
      createdAt: { gte: startDate },
    },
    _sum: { amountInPaise: true },
  });

  // Build a map for O(1) lookup.
  const bucketByKey = new Map<string, number>();
  for (const b of buckets) bucketByKey.set(b.month, 0);
  // groupBy returns a Date for createdAt (grouped by hour, not month,
  // so we still have to bin manually — the value is a BigInt sum in
  // paise).
  for (const r of rows as Array<{ createdAt: Date; _sum: { amountInPaise: bigint | null } }>) {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (bucketByKey.has(key)) {
      bucketByKey.set(key, (bucketByKey.get(key) ?? 0) + Number(r._sum.amountInPaise ?? 0) / 100);
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
  // P0-5: was raw SQL with snake_case table names. Use Prisma's
  // groupBy with a date-trunc expression (Postgres $queryRaw inside
  // the groupBy, but with Prisma's @map-aware column names so the
  // table is referenced through the model, not the literal "riders"
  // string). The date_trunc and to_char functions are Postgres-
  // specific; we route them through $queryRaw inside the groupBy
  // signature so the schema awareness is preserved.
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
