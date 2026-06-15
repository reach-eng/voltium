import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';

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
    activeRentals,
    totalHubs,
    pendingKyc,
    pendingGuarantor,
    pendingInfoRequired,
    totalAdmins,
  ] = await Promise.all([
    db.rider.count(),
    db.rider.count({ where: { lifecycleStatus: 'ACTIVE' } }),
    db.vehicle.count(),
    db.vehicle.count({ where: { status: 'AVAILABLE' } }),
    db.wallet.aggregate({ _sum: { balanceInPaise: true } }),
    db.wallet.aggregate({ _sum: { securityDeposit: true } }),
    db.transaction.count({ where: { status: 'PENDING' } }),
    db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    db.rider.count({ where: { lifecycleStatus: 'ACTIVE' } }),
    db.hub.count(),
    db.kycProfile.count({ where: { status: { in: ['PENDING', 'SUBMITTED'] } } }),
    db.guarantor.count({ where: { status: 'PENDING' } }),
    db.kycProfile.count({ where: { status: 'INFO_REQUIRED' } }),
    db.admin.count({ where: { isActive: true } }),
  ]);

  const totalBalance = paiseToRupees(walletBalanceResult._sum.balanceInPaise || 0);
  const totalDeposits = paiseToRupees(walletDepositResult._sum.securityDeposit || 0);

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
};

export const getRevenueTrend = async (days = 7) => {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const dailyMap = new Map<string, { revenue: number; riders: Set<string> }>();
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    const key = date.toISOString().split('T')[0];
    dailyMap.set(key, { revenue: 0, riders: new Set() });
  }

  // Use Prisma's query builder to avoid raw SQL queries
  const result = await db.$queryRaw<Array<{ date: string; revenue: bigint; riderCount: bigint }>>`
    SELECT
      DATE("createdAt") as date,
      SUM(amount) as revenue,
      COUNT(DISTINCT "riderId") as "riderCount"
    FROM "Transaction"
    WHERE "createdAt" >= ${startDate} AND status = 'SUCCESS' AND type = 'CREDIT'
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;

  for (const row of result) {
    const key = row.date;
    const entry = dailyMap.get(key);
    if (entry) {
      entry.revenue = Number(row.revenue) / 100;
      entry.riders = new Set([String(row.riderCount)]);
    }
  }

  return Array.from(dailyMap.entries()).map(([date, data]) => ({
    date: new Date(date).toLocaleDateString('en-IN', { weekday: 'short' }),
    revenue: Math.round(data.revenue),
    riders: data.riders.size,
  }));
};
