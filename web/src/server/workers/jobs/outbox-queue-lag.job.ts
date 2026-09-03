/**
 * Outbox queue-lag alerter (audit batch 7 P0-1).
 *
 * RUNBOOK_OPERATOR_DAY1.md:88 says "Confirm outbox queue lag is < 50
 * items" as a manual shift-handoff step. Before this job existed
 * there was no automated alerter — the operator had to remember to
 * check. This job runs every 5 minutes via the workers scheduler,
 * counts the unprocessed OutboxEvent rows (PENDING + PROCESSING),
 * and calls the alerter when the count crosses the threshold.
 *
 * Implementation notes:
 *   - Counts PENDING + PROCESSING (excludes COMPLETED + FAILED; the
 *     FAILED counter is separate and a future improvement can add
 *     a "stuck in FAILED for >1h" alerter).
 *   - The alerter is rate-limited to once per scheduled tick window
 *     (5 min) so a sustained backlog doesn't spam the Slack channel.
 *     Each tick is a single .send() call.
 *   - Threshold + interval are env-tunable so the on-call can dial
 *     them without redeploying.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { alerter } from '@/lib/alerter';
import { env } from '@/lib/env';
import { clock } from '@/lib/clock';

const DEFAULT_LAG_THRESHOLD = 50;
const DEFAULT_STUCK_PROCESSING_SEC = 300; // 5 min — a PROCESSING event older than this is "stuck"

export interface OutboxQueueLagResult {
  total: number; // PENDING + PROCESSING
  pending: number;
  processing: number;
  stuckProcessing: number; // PROCESSING older than DEFAULT_STUCK_PROCESSING_SEC
  threshold: number;
  alerted: boolean; // true if this run crossed the threshold and fired the alerter
  measuredAt: string; // ISO
}

/**
 * Count unprocessed outbox events. Exposed for tests + the metric
 * endpoint (the /api/admin/server-health surface in a follow-up).
 */
export async function getOutboxQueueLag(
  now: Date = clock.now()
): Promise<Omit<OutboxQueueLagResult, 'alerted' | 'threshold'>> {
  const stuckCutoff = new Date(now.getTime() - DEFAULT_STUCK_PROCESSING_SEC * 1000);

  const [pending, processing, stuckProcessing] = await Promise.all([
    db.outboxEvent.count({ where: { status: 'PENDING' } }),
    db.outboxEvent.count({ where: { status: 'PROCESSING' } }),
    db.outboxEvent.count({
      where: { status: 'PROCESSING', updatedAt: { lt: stuckCutoff } },
    }),
  ]);

  return {
    total: pending + processing,
    pending,
    processing,
    stuckProcessing,
    measuredAt: now.toISOString(),
  };
}

/**
 * Scheduled job: read the lag, fire the alerter if the threshold is
 * crossed. Called every 5 minutes by the workers scheduler. Returns
 * the snapshot for the caller's logs.
 */
export async function checkOutboxQueueLag(
  now: Date = clock.now()
): Promise<OutboxQueueLagResult> {
  const threshold = (env as any).OUTBOX_QUEUE_LAG_ALERT_THRESHOLD ?? DEFAULT_LAG_THRESHOLD;

  const snapshot = await getOutboxQueueLag(now);
  const crossedThreshold = snapshot.total >= threshold;
  const hasStuckEvents = snapshot.stuckProcessing > 0;

  // Fire on either: count over threshold, OR any PROCESSING event older
  // than 5 min (signals a worker crash). The alerter dedupes at the
  // scheduler level — every 5 min is the rate.
  if (crossedThreshold || hasStuckEvents) {
    const level = snapshot.stuckProcessing > 0 ? 'critical' : 'error';
    await alerter.send({
      level,
      title: `Outbox queue lag alert: ${snapshot.total} unprocessed event(s)`,
      message:
        `Lag is ${snapshot.total} (${snapshot.pending} PENDING, ${snapshot.processing} PROCESSING, ${snapshot.stuckProcessing} stuck in PROCESSING for >${DEFAULT_STUCK_PROCESSING_SEC}s). ` +
        `Threshold: ${threshold}. Manual check: ` +
        `psql ... -c "select count(*), status from \\"OutboxEvent\\" where status in ('PENDING','PROCESSING') group by status"`,
      source: 'outbox-queue-lag',
      details: {
        ...snapshot,
        threshold,
      },
    }).catch((err) => {
      logger.error('[OutboxQueueLag] alerter.send failed', {
        err: err instanceof Error ? err.message : String(err),
      });
    });
    logger.warn('[OutboxQueueLag] threshold crossed', snapshot);
  } else {
    logger.info('[OutboxQueueLag] within threshold', snapshot);
  }

  return {
    ...snapshot,
    threshold,
    alerted: crossedThreshold || hasStuckEvents,
  };
}

export const outboxQueueLagJob = {
  process: async (job?: any) => {
    return checkOutboxQueueLag(clock.now());
  },
};

