import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getMetrics, getSlowQueries } from '@/lib/apm';
import { getAdminSession } from '@/lib/get-session';
import { logger } from '@/lib/logger';
import { monitoringUseCases } from '@/server/modules/monitoring/monitoring.use-cases';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
  const session = isCron ? null : await getAdminSession();

  if (!isCron && !session) {
    return NextResponse.json(
      { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
      { status: 401 }
    );
  }

  try {
    const metrics = getMetrics();
    const slowQueries = getSlowQueries();
    const systemMetrics = await monitoringUseCases.getSystemMetrics();

    return NextResponse.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        apm: metrics,
        slowQueries: slowQueries.slice(0, 20),
        counts: {
          totalRiders: systemMetrics.totalRiders,
          activeRiders: systemMetrics.activeRiders,
          pendingKyc: systemMetrics.pendingKyc,
          pendingDeposits: systemMetrics.pendingDeposits,
          openTickets: systemMetrics.openTickets,
          transactionsLast24h: systemMetrics.recentTransactions,
          failedOutboxEvents: systemMetrics.failedOutbox,
          pendingOutboxEvents: systemMetrics.pendingOutbox,
          activeDeviceViolations: systemMetrics.activeViolations,
        },
        reconciliation: systemMetrics.latestReconciliation
          ? {
              date: systemMetrics.latestReconciliation.reportDate,
              matched: systemMetrics.latestReconciliation.matched,
              mismatched: systemMetrics.latestReconciliation.mismatched,
              drift: systemMetrics.latestReconciliation.drift,
              healthy: systemMetrics.latestReconciliation.mismatched === 0,
            }
          : null,
      },
    });
  } catch (err) {
    logger.error('[Metrics] Failed to collect metrics', err);
    return NextResponse.json(
      {
        success: false,
        error: { code: 'SERVER_ERROR', message: 'Failed to collect metrics' },
      },
      { status: 500 }
    );
  }
}
