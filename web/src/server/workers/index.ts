/**
 * Worker Orchestrator for Voltium background jobs.
 *
 * Polls the OutboxEvent table (PostgreSQL) for pending jobs.
 * No Redis dependency — all job state lives in the database.
 *
 * Designed to be run as:
 *   npx tsx src/server/workers/index.ts
 */

import { JobQueue, JobTypes } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { JOB_TYPES } from './queues';
import { sendSms } from '@/lib/sms-provider';

// Import job processors
import { reconciliationJob } from './jobs/reconciliation.job';
import { notificationsJob } from './jobs/notifications.job';
import { rentRemindersJob } from './jobs/rent-reminders.job';
import { deviceComplianceJob } from './jobs/device-compliance.job';
import { referralRewardJob } from './jobs/referral-reward.job';
import { auditCleanupJob } from './jobs/audit-cleanup.job';
import { telemetryCleanupJob } from './jobs/telemetry-cleanup.job';

// ---------------------------------------------------------------------------
// Worker registry — maps JobType to a processor function
// ---------------------------------------------------------------------------

type JobProcessor = (job: any) => Promise<any>;

interface WorkerDefinition {
  jobType: string;
  processor: JobProcessor;
  concurrency: number;
}

const WORKERS: WorkerDefinition[] = [
  {
    jobType: JOB_TYPES.WALLET_RECONCILIATION,
    processor: reconciliationJob.process,
    concurrency: 1,
  },
  {
    jobType: JOB_TYPES.ANNOUNCEMENT_DISPATCH,
    processor: notificationsJob.process,
    concurrency: 3,
  },
  {
    jobType: JOB_TYPES.RENT_DUE_CHECK,
    processor: rentRemindersJob.process,
    concurrency: 2,
  },
  {
    jobType: JOB_TYPES.DEVICE_VIOLATION_SCAN,
    processor: deviceComplianceJob.process,
    concurrency: 2,
  },
  {
    jobType: JOB_TYPES.REFERRAL_REWARD_PROCESS,
    processor: referralRewardJob.process,
    concurrency: 3,
  },
  {
    jobType: JOB_TYPES.AUDIT_LOG_CLEANUP,
    processor: auditCleanupJob.process,
    concurrency: 1,
  },
  {
    jobType: JOB_TYPES.TELEMETRY_DATA_CLEANUP,
    processor: telemetryCleanupJob.process,
    concurrency: 1,
  },
  {
    jobType: JobTypes.SEND_SMS,
    processor: async (job: any) => {
      const { phone, message } = job.payload as { phone: string; message: string };
      await sendSms(phone, message);
    },
    concurrency: 5,
  },
];

// ---------------------------------------------------------------------------
// Scheduled tasks
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

export async function startWorkers(): Promise<void> {
  if (running) {
    logger.warn('[Workers] Already running');
    return;
  }

  running = true;
  logger.info('[Workers] Starting all workers', {
    workerCount: WORKERS.length,
    jobTypes: WORKERS.map((w) => w.jobType),
  });

  // Start each worker in its own polling loop
  const promises = WORKERS.map((worker) => runWorkerLoop(worker));

  // Check scheduled backups every 5 minutes
  promises.push(runScheduledBackupLoop());

  await Promise.all(promises);
}

async function runWorkerLoop(worker: WorkerDefinition): Promise<void> {
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
          await processor(job);
        },
        concurrency
      );
    } catch (err) {
      logger.error(`[Worker] Error in ${jobType} loop`, err);
    }

    // Poll interval — check every 5 seconds
    await sleep(5000);
  }
}

async function runScheduledBackupLoop(): Promise<void> {
  while (running) {
    await checkScheduledBackups();
    await sleep(300_000); // Check every 5 minutes
  }
}

export function stopWorkers(): void {
  running = false;
  logger.info('[Workers] Stopping all workers');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// CLI entry point — run via: npx tsx src/server/workers/index.ts
// ---------------------------------------------------------------------------

export async function runFromCli(): Promise<void> {
  logger.info('[Workers] Starting from CLI');
  await startWorkers();
}

// Auto-start when executed directly (ESM-safe alternative to require.main)
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv.length >= 2 &&
  (process.argv[1]?.endsWith('workers/index.ts') ||
    process.argv[1]?.endsWith('workers/index.js') ||
    process.argv[1]?.endsWith('workers\\index.ts') ||
    process.argv[1]?.endsWith('workers\\index.js'));


if (isDirectRun) {
  runFromCli().catch((err) => {
    logger.error('[Workers] Fatal error', err);
    process.exit(1);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    logger.info('[Workers] SIGINT received — shutting down');
    stopWorkers();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    logger.info('[Workers] SIGTERM received — shutting down');
    stopWorkers();
    process.exit(0);
  });
}
