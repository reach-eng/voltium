import { db } from '@/lib/db';

export const monitoringUseCases = {
  async getSystemMetrics() {
    const [
      totalRiders,
      activeRiders,
      pendingKyc,
      pendingDeposits,
      openTickets,
      recentTransactions,
      failedOutbox,
      pendingOutbox,
      activeViolations,
      latestReconciliation,
    ] = await Promise.all([
      db.rider.count(),
      db.rider.count({ where: { lifecycleStatus: 'ACTIVE' } }),
      db.kycProfile.count({ where: { status: 'SUBMITTED' } }),
      db.depositRecord.count({ where: { status: 'PENDING_VERIFICATION' } }),
      db.supportTicket.count({ where: { status: 'OPEN' } }),
      db.transaction.count({ where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } } }),
      db.outboxEvent?.count({ where: { status: 'FAILED' } }).catch(() => 0),
      db.outboxEvent?.count({ where: { status: 'PENDING' } }).catch(() => 0),
      db.deviceViolation.count({ where: { status: 'ACTIVE' } }).catch(() => 0),
      db.reconciliationReport.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null),
    ]);
    return { totalRiders, activeRiders, pendingKyc, pendingDeposits, openTickets, recentTransactions, failedOutbox, pendingOutbox, activeViolations, latestReconciliation };
  },
};
