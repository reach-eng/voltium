/**
 * Worker Orchestrator for Voltium background jobs.
 *
 * Processes jobs from Redis-backed queues. Designed to be run as:
 *   npx tsx src/server/workers/index.ts
 *
 * Environment:
 *   - REDIS_URL / UPSTASH_REDIS_REST_URL must be set for queue processing
 *   - CRON_SECRET must be set for webhook-triggered cron replacements
 *   - NODE_ENV determines log level and fallback behavior
 */

import { JobQueue } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { QUEUE_CONFIGS, QUEUE_NAMES, JOB_TYPES, type QueueName } from './queues';

// Import job processors
import { reconciliationJob } from './jobs/reconciliation.job';
import { notificationsJob } from './jobs/notifications.job';
import { rentRemindersJob } from './jobs/rent-reminders.job';
import { deviceComplianceJob } from './jobs/device-compliance.job';
import { referralRewardJob } from './jobs/referral-reward.job';
import { auditCleanupJob } from './jobs/audit-cleanup.job';
import { telemetryCleanupJob } from './jobs/telemetry-cleanup.job';

// ---------------------------------------------------------------------------
// Worker registry — maps QueueName to a processor function
// ---------------------------------------------------------------------------

type JobProcessor = (job: any) => Promise<void>;

interface WorkerDefinition {
  queueName: QueueName;
  processor: JobProcessor;
  config: (typeof QUEUE_CONFIGS)[keyof typeof QUEUE_CONFIGS];
}

const WORKERS: WorkerDefinition[] = [
  {
    queueName: QUEUE_NAMES.RECONCILIATION,
    processor: reconciliationJob.process,
    config: QUEUE_CONFIGS.reconciliation,
  },
  {
    queueName: QUEUE_NAMES.NOTIFICATIONS,
    processor: notificationsJob.process,
    config: QUEUE_CONFIGS.notifications,
  },
  {
    queueName: QUEUE_NAMES.RENT_REMINDERS,
    processor: rentRemindersJob.process,
    config: QUEUE_CONFIGS.rentReminders,
  },
  {
    queueName: QUEUE_NAMES.DEVICE_COMPLIANCE,
    processor: deviceComplianceJob.process,
    config: QUEUE_CONFIGS.deviceCompliance,
  },
  {
    queueName: QUEUE_NAMES.REFERRAL_REWARDS,
    processor: referralRewardJob.process,
    config: QUEUE_CONFIGS.referralRewards,
  },
  {
    queueName: QUEUE_NAMES.AUDIT_CLEANUP,
    processor: auditCleanupJob.process,
    config: QUEUE_CONFIGS.auditCleanup,
  },
  {
    queueName: QUEUE_NAMES.TELEMETRY_CLEANUP,
    processor: telemetryCleanupJob.process,
    config: QUEUE_CONFIGS.telemetryCleanup,
  },
];

// ---------------------------------------------------------------------------
// Outbox pattern — processes pending outbox events
// ---------------------------------------------------------------------------

import { OutboxService } from './outbox';

async function processOutboxEvents(): Promise<void> {
  try {
    const processed = await OutboxService.processPendingEvents();
    if (processed > 0) {
      logger.info('[Workers] Processed outbox events', { count: processed });
    }
  } catch (err) {
    logger.error('[Workers] Outbox processing error', err);
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
    queues: WORKERS.map((w) => w.queueName),
  });

  // Start each worker in its own processing loop
  const promises = WORKERS.map((worker) => runWorkerLoop(worker));

  // Also process outbox events every 30 seconds
  promises.push(runOutboxLoop());

  await Promise.all(promises);
}

async function runWorkerLoop(worker: WorkerDefinition): Promise<void> {
  const { queueName, processor, config } = worker;

  logger.info(`[Worker] Starting loop for ${queueName}`, {
    concurrency: config.concurrency,
    maxRetries: config.maxRetries,
  });

  while (running) {
    try {
      await JobQueue.processJobs(
        getJobTypeFromQueue(queueName),
        async (job) => {
          logger.info(`[Worker] Processing job`, {
            queueName,
            jobId: job.id,
            type: job.type,
          });
          await processor(job);
        },
        config.concurrency
      );
    } catch (err) {
      logger.error(`[Worker] Error in ${queueName} loop`, err);
    }

    // Poll interval — check every 5 seconds
    await sleep(5000);
  }
}

async function runOutboxLoop(): Promise<void> {
  while (running) {
    await processOutboxEvents();
    await sleep(30_000);
  }
}

function getJobTypeFromQueue(queueName: QueueName): string {
  const mapping: Record<string, string> = {
    [QUEUE_NAMES.RECONCILIATION]: JOB_TYPES.WALLET_RECONCILIATION,
    [QUEUE_NAMES.NOTIFICATIONS]: JOB_TYPES.BIRTHDAY_WISHES,
    [QUEUE_NAMES.RENT_REMINDERS]: JOB_TYPES.RENT_DUE_CHECK,
    [QUEUE_NAMES.DEVICE_COMPLIANCE]: JOB_TYPES.DEVICE_VIOLATION_SCAN,
    [QUEUE_NAMES.REFERRAL_REWARDS]: JOB_TYPES.REFERRAL_REWARD_PROCESS,
    [QUEUE_NAMES.AUDIT_CLEANUP]: JOB_TYPES.AUDIT_LOG_CLEANUP,
    [QUEUE_NAMES.TELEMETRY_CLEANUP]: JOB_TYPES.TELEMETRY_DATA_CLEANUP,
    [QUEUE_NAMES.SMS_DISPATCH]: JOB_TYPES.SEND_SMS,
  };
  return mapping[queueName] || 'unknown';
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
