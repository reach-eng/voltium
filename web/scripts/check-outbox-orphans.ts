/**
 * check-outbox-orphans.ts (T-70)
 *
 * Audit batch 22 (2026-09-02, WK-002) flagged "10-20 orphan events per day"
 * as unverifiable from code alone. This script is the verification step:
 * run against the live DB (or a 7-day prod snapshot) to count the actual
 * number of FAILED / PROCESSING / stuck PENDING outbox events that the
 * orphan-event-consumer.job.ts (PR-151, web/src/server/workers/jobs/
 * orphan-event-consumer.job.ts) has not yet drained.
 *
 * Usage:
 *   npx tsx scripts/check-outbox-orphans.ts             # last 24h
 *   npx tsx scripts/check-outbox-orphans.ts --days 7   # last 7 days
 *   npx tsx scripts/check-outbox-orphans.ts --json    # machine-readable
 *
 * Exit codes:
 *   0 — orphans < 25 (acceptable, matches the audit's "10-20 per day" claim)
 *   1 — orphans >= 25 (alert: review orphan-consumer + worker health)
 *   2 — script error (DB connection, missing env)
 *
 * What it counts:
 *   - FAILED events with attempts < maxAttempts (transient, still being retried)
 *   - FAILED events with attempts >= maxAttempts (truly stuck, need manual replay)
 *   - PENDING events older than 1 hour (consumer not draining)
 *   - PROCESSING events older than 10 minutes (worker died mid-job)
 *
 * What it does NOT count (out of scope):
 *   - Successfully COMPLETED events (those are not orphans)
 *   - The orphan-consumer's own per-type breakdown (the 4 handled types
 *     are RENT_PAID, RENT_OVERDUE, DEVICE_VIOLATION, ADMIN_ACTION; anything
 *     else goes to the "no handler" warn-and-return path at orphan-event-
 *     consumer.job.ts:174-179)
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';

interface OrphanStats {
  windowDays: number;
  windowStart: string;
  windowEnd: string;
  failedTransient: number;
  failedStuck: number;
  pendingStale: number;
  processingStale: number;
  total: number;
  byEventType: Record<string, number>;
}

const STUCK_PROCESSING_THRESHOLD_MS = 10 * 60 * 1000; // 10 min
const STALE_PENDING_THRESHOLD_MS = 60 * 60 * 1000; // 1 hour

function parseArgs(): { days: number; json: boolean } {
  const args = process.argv.slice(2);
  let days = 1;
  let json = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--days' && args[i + 1]) {
      days = Number(args[i + 1]);
      i++;
    } else if (args[i] === '--json') {
      json = true;
    }
  }
  return { days: Math.max(1, Math.min(90, days)), json };
}

async function main(): Promise<number> {
  const { days, json } = parseArgs();
  const now = clock.now();
  const windowStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const [failedTransient, failedStuck, pendingStale, processingStale, byType] =
    await Promise.all([
      db.outboxEvent.count({
        where: {
          status: 'FAILED',
          attempts: { lt: 3 }, // matches maxAttempts default; see outbox.ts
          updatedAt: { gte: windowStart },
        },
      }),
      db.outboxEvent.count({
        where: {
          status: 'FAILED',
          attempts: { gte: 3 },
          updatedAt: { gte: windowStart },
        },
      }),
      db.outboxEvent.count({
        where: {
          status: 'PENDING',
          updatedAt: { lt: new Date(now.getTime() - STALE_PENDING_THRESHOLD_MS) },
        },
      }),
      db.outboxEvent.count({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: new Date(now.getTime() - STUCK_PROCESSING_THRESHOLD_MS) },
        },
      }),
      db.outboxEvent.groupBy({
        by: ['eventType'],
        where: {
          OR: [
            { status: 'FAILED' },
            {
              status: 'PENDING',
              updatedAt: { lt: new Date(now.getTime() - STALE_PENDING_THRESHOLD_MS) },
            },
            {
              status: 'PROCESSING',
              updatedAt: { lt: new Date(now.getTime() - STUCK_PROCESSING_THRESHOLD_MS) },
            },
          ],
          updatedAt: { gte: windowStart },
        },
        _count: true,
      }),
    ]);

  const byEventType: Record<string, number> = {};
  for (const row of byType) {
    byEventType[row.eventType] = row._count;
  }

  const total = failedTransient + failedStuck + pendingStale + processingStale;

  const stats: OrphanStats = {
    windowDays: days,
    windowStart: windowStart.toISOString(),
    windowEnd: now.toISOString(),
    failedTransient,
    failedStuck,
    pendingStale,
    processingStale,
    total,
    byEventType,
  };

  if (json) {
    process.stdout.write(JSON.stringify(stats, null, 2) + '\n');
  } else {
    logger.info('[OrphanCheck] Outbox orphan stats', stats as unknown as Record<string, unknown>);
    process.stdout.write(
      [
        `Window: last ${stats.windowDays} day(s) (${stats.windowStart} → ${stats.windowEnd})`,
        `  FAILED transient (attempts < 3):  ${stats.failedTransient}`,
        `  FAILED stuck (attempts >= 3):      ${stats.failedStuck}`,
        `  PENDING stale (>1h old):            ${stats.pendingStale}`,
        `  PROCESSING stale (>10min old):     ${stats.processingStale}`,
        `  TOTAL:                            ${stats.total}`,
        `By eventType:`,
        ...Object.entries(stats.byEventType)
          .sort(([, a], [, b]) => b - a)
          .map(([t, n]) => `  ${n.toString().padStart(5)}  ${t}`),
        '',
        `Thresholds:`,
        `  ALERT:  total >= 25  (review orphan-consumer + worker health)`,
        `  OK:     total <  25  (matches audit's "10-20 per day" claim)`,
      ].join('\n') + '\n'
    );
  }

  return total >= 25 ? 1 : 0;
}

main()
  .then((exitCode) => process.exit(exitCode))
  .catch((err) => {
    logger.error('[OrphanCheck] Failed', { error: err instanceof Error ? err.message : String(err) });
    process.exit(2);
  });
