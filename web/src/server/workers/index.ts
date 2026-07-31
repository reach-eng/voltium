/**
 * Worker Orchestrator for Voltium background jobs.
 *
 * Polls the OutboxEvent table (PostgreSQL) for pending jobs.
 * Cron-driven workers (audit cleanup, telemetry cleanup) run on
 * a direct timer interval, not through event polling.
 *
 * Designed to be run as:
 *   npx tsx src/server/workers/index.ts
 */

import { JobQueue } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { JOB_TYPES } from './queues';
import { validateSettingsConsistency } from '@/lib/settings-registry';
import { OutboxEventTypes } from './outbox';
import { sendSms } from '@/lib/sms-provider';

// Import job processors
import { reconciliationJob } from './jobs/reconciliation.job';
import { notificationDispatchJob } from './jobs/notification-dispatch.job';
import { dailyEngagementJob, msUntilNext0600IST } from './jobs/daily-engagement.job';
import { rentRemindersJob } from './jobs/rent-reminders.job';
import { deviceComplianceJob } from './jobs/device-compliance.job';
import { referralRewardJob } from './jobs/referral-reward.job';
import { auditCleanupJob } from './jobs/audit-cleanup.job';
import { telemetryCleanupJob } from './jobs/telemetry-cleanup.job';
// notifications.job.ts is deprecated (BLOCKER 1.4). Its birthday/payment
// reminder logic moved to daily-engagement.job.ts; its outbox mapping was
// the misroute that dropped per-event KYC/topup notifications. The file
// is intentionally left in the tree as a tombstone for one release and
// can be deleted in the next cleanup pass.

// ---------------------------------------------------------------------------
// Event-driven workers — poll the OutboxEvent table for matching event types
// ---------------------------------------------------------------------------

type JobProcessor = (job: any) => Promise<any>;

interface WorkerDefinition {
  jobType: string;
  processor: JobProcessor;
  concurrency: number;
  description: string;
}

const WORKERS: WorkerDefinition[] = [
  {
    // Processes wallet.topup_approved / wallet.topup_rejected events from wallet use-cases
    jobType: OutboxEventTypes.WALLET_RECONCILIATION,
    processor: reconciliationJob.process,
    concurrency: 1,
    description: 'Wallet reconciliation — triggered by topup approval/rejection',
  },
  {
    // BLOCKER 1.4: per-event notification dispatch (KYC, topup, support,
    // deposit, etc). Previously this was misrouted to the daily
    // birthday/payment reminder job, which ignored the payload and ran
    // only once per day. Now it dispatches by payload.type.
    jobType: OutboxEventTypes.NOTIFICATION_SEND,
    processor: notificationDispatchJob.process,
    concurrency: 3,
    description: 'Push/in-app notification dispatch (per-event)',
  },
  {
    // BLOCKER 1.4: daily birthday wishes + payment reminders + referral
    // leaderboard. Triggered by the scheduled task below at 06:00 IST.
    jobType: OutboxEventTypes.DAILY_ENGAGEMENT,
    processor: dailyEngagementJob.process,
    concurrency: 1,
    description: 'Daily engagement (birthday + payment reminder) at 06:00 IST',
  },
  {
    // Processes rent.due_check events (emitted on a timer by the scheduled loop below)
    jobType: OutboxEventTypes.RENT_DUE_CHECK,
    processor: rentRemindersJob.process,
    concurrency: 2,
    description: 'Rent due check & auto-debit',
  },
  {
    // Processes device.violation_scan events (emitted on a timer by the scheduled loop below)
    jobType: OutboxEventTypes.DEVICE_VIOLATION_SCAN,
    processor: deviceComplianceJob.process,
    concurrency: 2,
    description: 'Device compliance violation scanner',
  },
  {
    // Processes referral.reward events from referral-reward job
    jobType: OutboxEventTypes.REFERRAL_REWARD,
    processor: referralRewardJob.process,
    concurrency: 3,
    description: 'Referral reward processing',
  },
  {
    // SMS sends — processes sms.send events from auth use-cases
    jobType: OutboxEventTypes.SMS_SEND,
    processor: async (job: any) => {
      const { phone, message } = job.payload as { phone: string; message: string };
      await sendSms(phone, message);
    },
    concurrency: 5,
    description: 'SMS dispatch via provider',
  },
];

// ---------------------------------------------------------------------------
// Scheduled (cron-driven) workers — run directly on a timer, not event-polled
// ---------------------------------------------------------------------------

const SCHEDULED_TASKS: Array<{
  name: string;
  intervalMs: number;
  processor: (injectedClock: typeof clock) => Promise<void>;
}> = [
  {
    name: 'audit-log-cleanup',
    intervalMs: 300_000, // every 5 minutes
    processor: async () => {
      await auditCleanupJob.process({ id: 'scheduled' });
    },
  },
  {
    name: 'telemetry-cleanup',
    intervalMs: 300_000,
    processor: async () => {
      await telemetryCleanupJob.process({ id: 'scheduled' });
    },
  },
  {
    name: 'rent-due-emitter',
    intervalMs: 60_000, // every minute
    processor: async (injectedClock) => {
      const { OutboxService } = await import('./outbox');
      await OutboxService.emit(OutboxEventTypes.RENT_DUE_CHECK, {
        triggeredAt: injectedClock.now().toISOString(),
      }).catch((e: Error) => logger.error('[Scheduler] Failed to emit rent due check', e));
    },
  },
  {
    name: 'device-violation-emitter',
    intervalMs: 60_000, // every minute
    processor: async (injectedClock) => {
      const { OutboxService } = await import('./outbox');
      await OutboxService.emit(OutboxEventTypes.DEVICE_VIOLATION_SCAN, {
        triggeredAt: injectedClock.now().toISOString(),
      }).catch((e: Error) => logger.error('[Scheduler] Failed to emit device violation scan', e));
    },
  },
  {
    // BLOCKER 1.4: emit the daily engagement event at 06:00 IST.
    // msUntilNext0600IST() returns the delay until the next 06:00 IST;
    // after the first run, we reschedule by recomputing on each tick.
    name: 'daily-engagement-emitter',
    intervalMs: 60_000, // checked every minute; only emits at 06:00 IST
    processor: async (injectedClock) => {
      const msUntil = msUntilNext0600IST();
      // If we're within 1 minute of the target, fire now.
      if (msUntil > 60_000) return;
      const { OutboxService } = await import('./outbox');
      await OutboxService.emit(OutboxEventTypes.DAILY_ENGAGEMENT, {
        triggeredAt: injectedClock.now().toISOString(),
        istDate: new Intl.DateTimeFormat('en-CA', {
          timeZone: 'Asia/Kolkata',
        }).format(injectedClock.now()),
      }).catch((e: Error) =>
        logger.error('[Scheduler] Failed to emit daily engagement', e)
      );
    },
  },
];

// ---------------------------------------------------------------------------
// Scheduled backup check
// ---------------------------------------------------------------------------

import { scheduledBackupJob } from './jobs/scheduled-backup.job';

async function checkScheduledBackups(): Promise<void> {
  try {
    const result = await scheduledBackupJob.checkAndRun();
    if (result.ran) {
      logger.info('[Workers] Scheduled backup ran successfully');
    }
  } catch (err) {
    logger.error('[Workers] Scheduled backup check error', err);
  }
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

let running = false;
const activeJobs = new Set<Promise<any>>();

let globalAbortController: AbortController | null = null;

export async function startWorkers(injectedClock: typeof clock = clock): Promise<void> {
  if (running) {
    logger.warn('[Workers] Already running');
    return;
  }

  running = true;
  globalAbortController = new AbortController();

  // Pre-flight: validate settings consistency (non-blocking)
  await validateSettingsConsistency();

  logger.info('[Workers] Starting all workers', {
    workerCount: WORKERS.length,
    scheduledTaskCount: SCHEDULED_TASKS.length,
    jobTypes: WORKERS.map((w) => w.jobType),
  });

  const promises: Promise<void>[] = [];

  // Event-driven workers — each polls its own event type
  for (const worker of WORKERS) {
    promises.push(runWorkerLoop(worker, injectedClock));
  }

  // Scheduled tasks — run on direct timer
  for (const task of SCHEDULED_TASKS) {
    promises.push(runScheduledTask(task, injectedClock));
  }

  // Scheduled backup check — every 5 minutes
  promises.push(runScheduledBackupLoop(injectedClock));

  // Reaper — every 5 minutes
  promises.push(runReaperLoop(injectedClock));

  await Promise.all(promises);
}

async function runWorkerLoop(worker: WorkerDefinition, injectedClock: typeof clock): Promise<void> {
  const { jobType, processor, concurrency } = worker;

  logger.info(`[Worker] Starting loop for ${jobType}`, { concurrency });

  while (running) {
    try {
      await JobQueue.processJobs(
        jobType,
        async (job) => {
          logger.info(`[Worker] Processing job`, {
            jobType,
            jobId: job.id,
          });
          const promise = processor(job);
          activeJobs.add(promise);
          try {
            await promise;
          } finally {
            activeJobs.delete(promise);
          }
        },
        concurrency
      );
    } catch (err) {
      logger.error(`[Worker] Error in ${jobType} loop`, err);
    }

    await sleep(5000);
  }
}

async function runScheduledTask(task: {
  name: string;
  intervalMs: number;
  processor: (injectedClock: typeof clock) => Promise<void>;
}, injectedClock: typeof clock): Promise<void> {
  logger.info(`[Scheduler] Starting scheduled task "${task.name}"`, {
    intervalMs: task.intervalMs,
  });

  while (running) {
    try {
      await task.processor(injectedClock);
    } catch (err) {
      logger.error(`[Scheduler] Error in "${task.name}"`, err);
    }
    await sleep(task.intervalMs);
  }
}

async function runScheduledBackupLoop(injectedClock: typeof clock): Promise<void> {
  while (running) {
    await checkScheduledBackups();
    await sleep(300_000);
  }
}

async function runReaperLoop(injectedClock: typeof clock): Promise<void> {
  while (running) {
    try {
      const { JobQueue } = await import('@/lib/job-queue');
      const reclaimed = await JobQueue.runReaper();
      if (reclaimed > 0) {
        logger.warn('[Reaper] Reclaimed stuck processing jobs', { count: reclaimed });
      }
    } catch (err) {
      logger.error('[Reaper] Error during reaper cycle', err);
    }
    await sleep(300_000);
  }
}

export function stopWorkers(): void {
  running = false;
  if (globalAbortController) {
    globalAbortController.abort();
  }
  logger.info('[Workers] Stopping all workers');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (!running || !globalAbortController) {
      return resolve();
    }
    const timeout = setTimeout(resolve, ms);
    globalAbortController.signal.addEventListener('abort', () => {
      clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

export async function runFromCli(): Promise<void> {
  logger.info('[Workers] Starting from CLI');
  await startWorkers();
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv.length >= 2 &&
  (process.argv[1]?.endsWith('workers/index.ts') ||
    process.argv[1]?.endsWith('workers/index.js') ||
    process.argv[1]?.endsWith('workers\\index.ts') ||
    process.argv[1]?.endsWith('workers\\index.js') ||
    process.argv[1]?.endsWith('workers\\\\index.ts') ||
    process.argv[1]?.endsWith('workers\\\\index.js') ||
    process.argv[1]?.endsWith('workers.js') ||
    process.argv[1]?.endsWith('workers.ts'));

async function handleShutdown(signal: string) {
  logger.info(`[Workers] ${signal} received — starting graceful shutdown`);
  stopWorkers();

  if (activeJobs.size > 0) {
    logger.info(`[Workers] Waiting for ${activeJobs.size} in-flight jobs to complete...`);
    const shutdownTimeout = new Promise((resolve) => setTimeout(resolve, 30000));
    await Promise.race([Promise.all(Array.from(activeJobs)), shutdownTimeout]);
    if (activeJobs.size > 0) {
      logger.warn(
        `[Workers] Graceful shutdown timed out. ${activeJobs.size} jobs still in-flight.`
      );
    } else {
      logger.info('[Workers] All in-flight jobs completed successfully');
    }
  } else {
    logger.info('[Workers] No in-flight jobs to wait for');
  }
  process.exit(0);
}

if (isDirectRun) {
  runFromCli().catch((err) => {
    logger.error('[Workers] Fatal error', err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    handleShutdown('SIGINT').catch((err) => {
      logger.error('[Workers] Error during SIGINT handler', err);
      process.exit(1);
    });
  });

  process.on('SIGTERM', () => {
    handleShutdown('SIGTERM').catch((err) => {
      logger.error('[Workers] Error during SIGTERM handler', err);
      process.exit(1);
    });
  });
}
