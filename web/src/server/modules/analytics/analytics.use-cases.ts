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

    const [totalRiders, activeRiders, totalVehicles, activeRentals] = await Promise.all([
      db.rider.count(),
      db.rider.count({ where: { state: 'ACTIVE' } }),
      db.vehicle.count(),
      db.rider.count({ where: { rentalStatus: 'ACTIVE' } }),
    ]);

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

    const [totalRiders, activeRiders, currentMonthTransactions, lastMonthTransactions, monthlyTrend, cohortData] = await Promise.all([
      db.rider.count(),
      db.rider.count({ where: { accountStatus: 'POST_ACTIVE' } }),
      db.transaction.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: startOfMonth } }, _sum: { amount: true } }),
      db.transaction.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: startOfLastMonth, lte: endOfLastMonth } }, _sum: { amount: true } }),
      getMonthlyTrend(twelveMonthsAgo),
      getCohortData(),
    ]);

    const currentMRR = (currentMonthTransactions._sum.amount ?? 0) / 100;
    const lastMRR = (lastMonthTransactions._sum.amount ?? 0) / 100;
    const mrrGrowth = lastMRR > 0 ? ((currentMRR - lastMRR) / lastMRR) * 100 : 0;

    const lastMonthActiveRiders = await db.rider.count({ where: { accountStatus: 'POST_ACTIVE', createdAt: { lt: startOfMonth } } });
    const churnedRiders = await db.rider.count({ where: { accountStatus: 'SUSPENDED', updatedAt: { gte: startOfMonth } } });
    const churnRate = lastMonthActiveRiders > 0 ? (churnedRiders / lastMonthActiveRiders) * 100 : 0;

    const totalVehicles = await db.vehicle.count();
    const activeVehicles = await db.vehicle.count({ where: { status: 'RENTED' } });

    return {
      overview: {
        totalRiders, activeRiders, currentMRR,
        mrrGrowth: Math.round(mrrGrowth * 100) / 100,
        avgRevenuePerRider: activeRiders > 0 ? Math.round((currentMRR / activeRiders) * 100) / 100 : 0,
        churnRate: Math.round(churnRate * 100) / 100,
        collectionEfficiency: activeVehicles > 0 ? Math.round((activeVehicles / totalVehicles) * 10000) / 100 : 0,
        totalVehicles, activeVehicles,
      },
      trend: monthlyTrend,
      cohorts: cohortData,
    };
  },
};

async function getMonthlyTrend(startDate: Date) {
  const transactions = await db.transaction.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: startDate } },
    select: { amount: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const monthlyData: Record<string, number> = {};
  transactions.forEach((t) => {
    const key = `${t.createdAt.getFullYear()}-${String(t.createdAt.getMonth() + 1).padStart(2, '0')}`;
    monthlyData[key] = (monthlyData[key] || 0) + t.amount / 100;
  });

  return Object.entries(monthlyData).sort(([a], [b]) => a.localeCompare(b)).map(([month, revenue]) => ({ month, revenue }));
}

async function getCohortData() {
  const riders = await db.rider.findMany({ select: { id: true, createdAt: true, accountStatus: true, updatedAt: true } });
  const cohorts: Record<string, { total: number; active: number; suspended: number }> = {};

  riders.forEach((r) => {
    const key = `${r.createdAt.getFullYear()}-${String(r.createdAt.getMonth() + 1).padStart(2, '0')}`;
    if (!cohorts[key]) cohorts[key] = { total: 0, active: 0, suspended: 0 };
    cohorts[key].total++;
    if (r.accountStatus === 'POST_ACTIVE') cohorts[key].active++;
    if (r.accountStatus === 'SUSPENDED') cohorts[key].suspended++;
  });

  return Object.entries(cohorts).sort(([a], [b]) => a.localeCompare(b)).map(([month, data]) => ({
    month, ...data,
    retentionRate: data.total > 0 ? Math.round((data.active / data.total) * 10000) / 100 : 0,
  }));
}
