import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '@/lib/date-utils';

export const getDashboardStats = async () => {
  const [
    totalRiders,
    activeRiders,
    totalVehicles,
    availableVehicles,
    walletAggregate,
    revenueAggregate,
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
    db.wallet.aggregate({ _sum: { balanceInPaise: true, securityDeposit: true } }),
    db.transaction.aggregate({
      _sum: { amount: true },
      where: { status: 'APPROVED', type: 'CREDIT' },
    }),
    db.transaction.count({ where: { status: 'PENDING' } }),
    db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    db.rental.count({ where: { status: 'ACTIVE' } }),
    db.hub.count(),
    db.kycProfile.count({ where: { status: { in: ['PENDING', 'SUBMITTED'] } } }),
    db.guarantor.count({ where: { status: 'PENDING' } }),
    db.kycProfile.count({ where: { status: 'INFO_REQUIRED' } }),
    db.admin.count({ where: { isActive: true } }),
  ]);

  const totalBalance = paiseToRupees(walletAggregate._sum.balanceInPaise || 0);
  const totalDeposits = paiseToRupees(walletAggregate._sum.securityDeposit || 0);
  const totalRevenue = paiseToRupees(revenueAggregate._sum.amount || 0);

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

  // Use Prisma's query builder to avoid raw SQL queries
  const result = await db.$queryRaw<Array<{ date: string; revenue: bigint; riderCount: bigint }>>`
    SELECT
      DATE("createdAt") as date,
      SUM(amount) as revenue,
      COUNT(DISTINCT "riderId") as "riderCount"
    FROM "Transaction"
    WHERE "createdAt" >= ${startDate} AND status = 'APPROVED' AND type = 'CREDIT'
    GROUP BY DATE("createdAt")
    ORDER BY date ASC
  `;

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
};
