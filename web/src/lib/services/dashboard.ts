import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';
import { rawQuery } from '@/lib/raw-query';

export const getDashboardStats = async () => {
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
    totalRevenueResult,
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
    db.transaction.aggregate({
      where: { status: 'APPROVED', type: 'DEBIT', purpose: 'RENT_PAYMENT' },
      _sum: { amountInPaise: true },
    }),
  ]);

  const totalBalance = paiseToRupees(walletBalanceResult._sum.balanceInPaise || 0);
  const totalDeposits = paiseToRupees(walletDepositResult._sum.securityDepositInPaise || 0);
  const totalRevenue = paiseToRupees(totalRevenueResult._sum.amountInPaise || 0);

  return {
    totalRiders,
    activeRiders,
    totalVehicles,
    availableVehicles,
    totalBalance,
    totalDeposits,
    totalRevenue,
    pendingTransactions,
    openTickets,
    activeRentals,
    totalHubs,
    pendingKyc,
    pendingGuarantor,
    pendingInfoRequired,
    totalAdmins,
  };
};

export const getRevenueTrend = async (days = 7) => {
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
  ) as Array<{ date: string | Date; revenue: bigint; riderCount: bigint }>;

  for (const row of result) {
    const key =
      row.date instanceof Date
        ? row.date.toISOString().split('T')[0]
        : typeof row.date === 'string'
          ? row.date.split('T')[0]
          : String(row.date);
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
};
