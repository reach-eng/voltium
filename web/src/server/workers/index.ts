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

import { JobQueue, type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { JOB_TYPES } from './queues';
import { OutboxEventTypes } from './outbox';
import { sendSms } from '@/lib/sms-provider';
import { alerter } from '@/lib/alerter';

// Import job processors
import { reconciliationJob } from './jobs/reconciliation.job';
import { notificationDispatchJob } from './jobs/notification-dispatch.job';
// P0-1/P0-9 (2026-08-05 ops audit): admin broadcast worker — the route
// emits NOTIFICATION_BROADCAST (after rate-limit + ?confirm=true) and this
// job runs the batched insert in the background.
import { notificationBroadcastJob } from './jobs/notification-broadcast.job';
import { dailyEngagementJob, msUntilNext0600IST } from './jobs/daily-engagement.job';
import { rentRemindersJob } from './jobs/rent-reminders.job';
import { deviceComplianceJob } from './jobs/device-compliance.job';
import { referralRewardJob } from './jobs/referral-reward.job';
import { auditCleanupJob } from './jobs/audit-cleanup.job';
import { telemetryCleanupJob } from './jobs/telemetry-cleanup.job';
import { notificationsCleanupJob } from './jobs/notifications-cleanup.job';
// PR-7 (2026-08-06 fix-plan; 1st audit P0-1): hard-anonymizes riders whose
// soft-deletion is older than 7 days (GDPR/DPDP §6 data minimization). The
// admin DELETE endpoint is soft-delete; this scheduled job is the hard-delete.
import { dataDeletionPurgeJob } from './jobs/data-deletion-purge.job';
// PR-151: handles the 4 orphan outbox event types (RENT_PAID, RENT_OVERDUE,
// DEVICE_VIOLATION, ADMIN_ACTION) that had no consumer before. See
// docs/AUDIT_WORKERS.md §6.1-6.8 and orphan-event-consumer.job.ts.
import { orphanEventConsumerJob } from './jobs/orphan-event-consumer.job';
// PR-7 (2026-08-06 fix-plan; 6th audit P0): purges PRE_RESTORE backups
// orphaned by failed restores (errorMessage = ORPHANED_BY_FAILED_RESTORE:…)
// once they cross the 7-day operator-acknowledgement window.
import { orphanBackupCleanupJob } from './jobs/orphan-backup-cleanup.job';
// PR-4 (2026-08-06 fix-plan; 9th audit P0): announcement fanout moved out of
// the request transaction into this background job (same pattern as
// notification-broadcast.job.ts).
import { announcementBroadcastJob } from './jobs/announcement-broadcast.job';
// AUDIT-RECON 2026-09-02 batch 7 P0-1: the outbox queue-lag alerter.
// RUNBOOK_OPERATOR_DAY1.md:88 used to say "confirm outbox queue lag
// is < 50 items" as a manual shift-handoff step — this job
// automates the check and posts to Slack when the count crosses
// OUTBOX_QUEUE_LAG_ALERT_THRESHOLD (default 50). Runs every 5 min.
import { checkOutboxQueueLag } from './jobs/outbox-queue-lag.job';
// notifications.job.ts is deprecated (BLOCKER 1.4). Its birthday/payment
// reminder logic moved to daily-engagement.job.ts; its outbox mapping was
// the misroute that dropped per-event KYC/topup notifications. The file
// is intentionally left in the tree as a tombstone for one release and
// can be deleted in the next cleanup pass.

// ---------------------------------------------------------------------------
// Event-driven workers — poll the OutboxEvent table for matching event types
// ---------------------------------------------------------------------------

type JobProcessor = (job: QueueJob) => Promise<unknown>;
type OutboxPriority = 'interactive' | 'background';

interface WorkerDefinition {
  jobType: string;
  processor: JobProcessor;
  concurrency: number;
  description: string;
  /**
   * PR-75: priority split. 'interactive' workers are polled first
   * and are not blocked by background work. 'background' workers
   * are gated to run only when no interactive events are PENDING
   * (checked on each poll cycle). See AUDIT_BACKEND_2026-08-03.md
   * §2.A.N2 and AUDIT_FIX_PLAN_2026-08-03.md PR-75 for context.
   */
  priority: OutboxPriority;
  maxAttempts?: number;
}

export const WORKERS: WorkerDefinition[] = [
  {
    // P0-5 unification (financial audit / audit #23 P0-1): BOTH reconciliation
    // event types now run the same single-SQL processor. The admin-jobs route
    // (POST /api/admin/jobs) emits ADMIN_JOB_WALLET_RECONCILIATION with the
    // triggering admin in `payload.triggeredBy` (attributed in the audit log);
    // wallet.reconciliation is reserved for system triggers. The processor
    // persists the daily reconciliationReport row (so the admin Jobs screen
    // and the cron pre-check both see it) and records the audit entry.
    jobType: OutboxEventTypes.WALLET_RECONCILIATION,
    processor: reconciliationJob.process,
    concurrency: 1,
    description: 'Wallet reconciliation — single-SQL drift check (system trigger)',
    priority: 'background',
  },
  {
    jobType: OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
    processor: reconciliationJob.process,
    concurrency: 1,
    description: 'Wallet reconciliation — admin-triggered via Background Jobs screen',
    priority: 'background',
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
    priority: 'interactive',
  },
  {
    // P0-1/P0-9 (2026-08-05 ops audit): admin "send to all riders" broadcast.
    // Background priority — per-event dispatch (interactive) takes precedence.
    // Concurrency 1 so two concurrent broadcasts can't double the insert rate.
    jobType: OutboxEventTypes.NOTIFICATION_BROADCAST,
    processor: notificationBroadcastJob.process,
    concurrency: 1,
    description: 'Admin broadcast — batched notification to all riders',
    priority: 'background',
  },
  {
    // PR-4 (2026-08-06 fix-plan; 9th audit P0): announcement fanout for
    // ALL / BY_HUB / BY_STATUS / BY_PLAN audiences. Background priority
    // like the notification broadcast; concurrency 1 so two overlapping
    // announcements can't double the insert rate.
    jobType: OutboxEventTypes.ANNOUNCEMENT_BROADCAST,
    processor: announcementBroadcastJob.process,
    concurrency: 1,
    description: 'Announcement fanout (all / by-hub / by-status / by-plan audiences)',
    priority: 'background',
  },
  {
    // BLOCKER 1.4: daily birthday wishes + payment reminders + referral
    // leaderboard. Triggered by the scheduled task below at 06:00 IST.
    jobType: OutboxEventTypes.DAILY_ENGAGEMENT,
    processor: dailyEngagementJob.process,
    concurrency: 1,
    description: 'Daily engagement (birthday + payment reminder) at 06:00 IST',
    // PR-42 (EVENT_BUS P1-2): flipped from 'interactive' to 'background'.
    // The job runs at 06:00 IST once a day, never interacts with a
    // user's tap/click path, and is fully deferred to off-peak. It
    // should not compete with rider-facing interactive workers
    // (rental, payment, support) for capacity.
    priority: 'background',
  },
  {
    // PR-VER-2026-08-07 (EVENT_BUS P1-2): the admin "Daily Engagement"
    // Run-now button emits ADMIN_JOB_DAILY_ENGAGEMENT — which previously
    // had NO worker, so the outbox row sat PENDING forever and the admin
    // trigger was a silent no-op (same bug class as ADMIN_JOB_RENT_DUE_CHECK).
    // Wire it to the same processor; the job is idempotent per IST day so an
    // admin re-run mid-day is a no-op. Background priority per the jobs-route
    // config (admin-triggered engagement must not starve interactive work).
    jobType: OutboxEventTypes.ADMIN_JOB_DAILY_ENGAGEMENT,
    processor: dailyEngagementJob.process,
    concurrency: 1,
    description: 'Daily engagement — admin-triggered via Background Jobs screen',
    priority: 'background',
  },
  {
    // Processes rent.due_check events (emitted on a timer by the scheduled loop below)
    jobType: OutboxEventTypes.RENT_DUE_CHECK,
    processor: rentRemindersJob.process,
    concurrency: 2,
    description: 'Rent due check & auto-debit',
    priority: 'interactive',
  },
  {
    // PR-VER-2026-08-06 (EVENT_BUS P0-6): the admin "Rent Due Checker"
    // Run-now button emits ADMIN_JOB_RENT_DUE_CHECK — which previously had
    // NO worker, so the outbox row sat PENDING forever and the admin trigger
    // was a silent no-op. Wire it to the same full-pass processor.
    jobType: OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
    processor: rentRemindersJob.process,
    concurrency: 1,
    description: 'Rent due check — admin-triggered (full pass)',
    priority: 'interactive',
  },
  {
    // PR-VER-2026-08-06 (EVENT_BUS P0-6): the admin "Auto-Debit" job card
    // is now its own event + processor. It runs the same job in debit-only
    // mode (no overdue notifications/RENT_OVERDUE emits).
    jobType: OutboxEventTypes.ADMIN_JOB_AUTO_DEBIT,
    processor: (job: QueueJob) => rentRemindersJob.process(job, { mode: 'debit-only' }),
    concurrency: 1,
    description: 'Auto-debit — admin-triggered (debit only)',
    priority: 'interactive',
  },
  {
    // Processes device.violation_scan events (emitted on a timer by the scheduled loop below)
    jobType: OutboxEventTypes.DEVICE_VIOLATION_SCAN,
    processor: deviceComplianceJob.process,
    concurrency: 2,
    description: 'Device compliance violation scanner',
    priority: 'background',
  },
  {
    // Processes referral.reward events from referral-reward job
    jobType: OutboxEventTypes.REFERRAL_REWARD,
    processor: referralRewardJob.process,
    concurrency: 3,
    description: 'Referral reward processing',
    priority: 'interactive',
  },
  {
    // SMS sends — processes sms.send events from auth use-cases
    jobType: OutboxEventTypes.SMS_SEND,
    processor: async (job: QueueJob) => {
      const { phone, message } = job.payload as { phone: string; message: string };
      await sendSms(phone, message);
    },
    concurrency: 5,
    description: 'SMS dispatch via provider',
    priority: 'interactive',
  },
  {
    // PR-115: notification cleanup — purges read notifications older than 30 days.
    // Triggered by the admin "Run now" button on the Background Jobs screen
    // (see /api/admin/jobs/route.ts). Background priority — interactive work
    // (per-event notification dispatch) takes precedence.
    jobType: OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP,
    processor: notificationsCleanupJob.process,
    concurrency: 1,
    description: 'Notification cleanup — purge read notifications older than 30 days',
    priority: 'background',
  },
  {
    jobType: OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP,
    processor: telemetryCleanupJob.process,
    concurrency: 1,
    description: 'Telemetry cleanup — purge PII > 30 days',
    priority: 'background',
  },
  // PR-151: wires the 4 orphan outbox event types that previously had
  // no consumer (events piled up in the outbox table forever). Each
  // eventType gets its own worker entry but they all delegate to the
  // same processor (orphan-event-consumer.job), which routes by
  // eventType. AUDIT_WORKERS.md §6.1-6.8.
  {
    jobType: OutboxEventTypes.RENT_PAID,
    processor: orphanEventConsumerJob.process,
    concurrency: 2,
    description: 'Orphan consumer: RENT_PAID — send rent paid receipt to rider',
    priority: 'interactive',
  },
  {
    jobType: OutboxEventTypes.RENT_OVERDUE,
    processor: orphanEventConsumerJob.process,
    concurrency: 2,
    description: 'Orphan consumer: RENT_OVERDUE — escalate to rider, alert ops if balance is critical',
    priority: 'interactive',
  },
  {
    jobType: OutboxEventTypes.DEVICE_VIOLATION,
    processor: orphanEventConsumerJob.process,
    concurrency: 2,
    description: 'Orphan consumer: DEVICE_VIOLATION — alert admin via Slack + audit log',
    priority: 'background',
    maxAttempts: 3,
  },
  {
    jobType: OutboxEventTypes.ADMIN_ACTION,
    processor: orphanEventConsumerJob.process,
    concurrency: 2,
    description: 'Orphan consumer: ADMIN_ACTION — log + alert (e.g. reconciliation mismatch)',
    priority: 'background',
  },
];

// ---------------------------------------------------------------------------
// Scheduled (cron-driven) workers — run directly on a timer, not event-polled
// ---------------------------------------------------------------------------

// P0-1 fix: fire-once guard for the daily engagement emitter.
// Stores the IST date (YYYY-MM-DD) of the last successful emit.
// Prevents the 60-tick window between 05:59 and 06:00 IST from
// emitting 60 outbox rows.
let lastEngagementFiredDate: string | null = null;
// PR-VER-2026-08-06 (EVENT_BUS P0-3): fire-once guard for the daily wallet
// reconciliation emitter (same pattern).
let lastReconciliationFiredDate: string | null = null;

const SCHEDULED_TASKS: Array<{
  name: string;
  intervalMs: number;
  processor: (injectedClock: typeof clock) => Promise<void>;
}> = [
  {
    name: 'audit-log-cleanup',
    intervalMs: 60_000, // checked every minute; idempotency key guards execution
    processor: async () => {
      await auditCleanupJob.process({ id: 'scheduled' });
    },
  },
  {
    name: 'outbox-completed-cleanup',
    intervalMs: 60_000, // check every minute; only runs at 03:00 IST
    processor: async (injectedClock) => {
      // P0-5: fixed IST clock time instead of startup-relative 24h timer
      const istHour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          hour12: false,
        }).format(injectedClock.now())
      );
      if (istHour !== 3) return;

      const { OutboxService } = await import('./outbox');
      const count = await OutboxService.cleanupCompleted(1);
      logger.info('[Scheduler] Outbox completed events cleanup', { count });
    },
  },
  {
    name: 'telemetry-cleanup',
    intervalMs: 60_000, // checked every minute; idempotency key guards execution
    processor: async () => {
      await telemetryCleanupJob.process({ id: 'scheduled' });
    },
  },
  {
    // PR-7 (1st audit P0-1): hard-anonymize riders soft-deleted > 7 days.
    // Checked every minute; the job's IST-date idempotency key makes it
    // fire-once-per-day.
    name: 'data-deletion-purge',
    intervalMs: 60_000,
    processor: async () => {
      await dataDeletionPurgeJob.process({ id: 'scheduled' });
    },
  },
  {
    // PR-7 (2026-08-06 fix-plan; 6th audit P0): purge pre-restore backups
    // orphaned by failed restores after the 7-day acknowledgement window.
    // Checked every minute; the job's IST-date idempotency key makes it
    // fire-once-per-day, and the 7-day cutoff is relative to createdAt.
    name: 'orphan-backup-cleanup',
    intervalMs: 60_000,
    processor: async () => {
      await orphanBackupCleanupJob.process({ id: 'scheduled' });
    },
  },
  {
    // PR-VER-2026-08-06 (EVENT_BUS P0-3): WALLET_RECONCILIATION had a
    // consumer but NO producer — the "Daily (02:00 IST)" reconciliation
    // shown in the Background Jobs screen only ran when an admin clicked
    // Run-now. This scheduled emitter is the missing system trigger.
    name: 'wallet-reconciliation-emitter',
    intervalMs: 60_000, // checked every minute; fires once per IST day
    processor: async (injectedClock) => {
      const istHour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          hour12: false,
        }).format(injectedClock.now())
      );
      if (istHour !== 2) return;

      const todayIst = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
      }).format(injectedClock.now());
      if (lastReconciliationFiredDate === todayIst) return;
      lastReconciliationFiredDate = todayIst;

      const { OutboxService } = await import('./outbox');
      await OutboxService.emit(
        OutboxEventTypes.WALLET_RECONCILIATION,
        { triggeredAt: injectedClock.now().toISOString(), trigger: 'scheduled' },
        3,
        undefined,
        'background'
      ).catch((e: Error) =>
        logger.error('[Scheduler] Failed to emit wallet reconciliation', e)
      );
    },
  },
  {
    name: 'rent-due-emitter',
    intervalMs: 60_000, // checked every minute
    processor: async (injectedClock) => {
      // P0-2: only fire at 06:00 IST or 18:00 IST (±30 min)
      const istHour = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          hour12: false,
        }).format(injectedClock.now())
      );
      if (istHour !== 6 && istHour !== 18) return;

      const todayIst = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
      }).format(injectedClock.now());

      const { OutboxService } = await import('./outbox');
      // PR-75: rent-due check is interactive — the rent reminders
      // worker is on the interactive list (see WORKERS above).
      // Fire-once is the IST-hour window check above (P0-2); the emit
      // signature takes `tx` (not an idempotency key) as the 4th arg, so
      // pass undefined — the hour gate is the dedup.
      await OutboxService.emit(
        OutboxEventTypes.RENT_DUE_CHECK,
        { triggeredAt: injectedClock.now().toISOString() },
        3,
        undefined,
        'interactive'
      ).catch((e: Error) => logger.error('[Scheduler] Failed to emit rent due check', e));
    },
  },
  {
    name: 'device-violation-emitter',
    intervalMs: 60_000, // every minute
    processor: async (injectedClock) => {
      const { OutboxService } = await import('./outbox');
      // device compliance is background — the deviceComplianceJob
      // is wired to priority='background'.
      await OutboxService.emit(
        OutboxEventTypes.DEVICE_VIOLATION_SCAN,
        { triggeredAt: injectedClock.now().toISOString() },
        3
      ).catch((e: Error) => logger.error('[Scheduler] Failed to emit device violation scan', e));
    },
  },
  {
    // BLOCKER 1.4: emit the daily engagement event at 06:00 IST.
    // msUntilNext0600IST() returns the delay until the next 06:00 IST;
    // after the first run, we reschedule by recomputing on each tick.
    name: 'daily-engagement-emitter',
    intervalMs: 60_000, // checked every minute; only emits at 06:00 IST
    processor: async (injectedClock) => {
      const msUntil = msUntilNext0600IST(injectedClock.now());
      // If we're within 1 minute of the target, fire now.
      if (msUntil > 60_000) return;

      // P0-1: fire-once per IST calendar day
      const todayIst = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata',
      }).format(injectedClock.now());
      if (lastEngagementFiredDate === todayIst) return;
      lastEngagementFiredDate = todayIst;

      const { OutboxService } = await import('./outbox');
      // PR-75: daily engagement is interactive (birthday wishes,
      // payment reminders) — the dailyEngagementJob is on the
      // interactive list.
      await OutboxService.emit(
        OutboxEventTypes.DAILY_ENGAGEMENT,
        {
          triggeredAt: injectedClock.now().toISOString(),
          istDate: todayIst,
        },
        3,
        undefined,
        'interactive'
      ).catch((e: Error) =>
        logger.error('[Scheduler] Failed to emit daily engagement', e)
      );
    },
  },
  {
    // AUDIT-RECON 2026-09-02 batch 7 P0-1: outbox queue-lag alerter.
    // Checks PENDING + PROCESSING counts every 5 min; fires the
    // alerter (Slack webhook via lib/alerter) when the total crosses
    // OUTBOX_QUEUE_LAG_ALERT_THRESHOLD (default 50) OR when any
    // PROCESSING event is older than 5 min (a worker crash signal).
    // 5 min cadence is the alert rate cap — a sustained backlog
    // posts at most 12 messages/hour to the channel.
    name: 'outbox-queue-lag-alerter',
    intervalMs: 5 * 60_000,
    processor: async (injectedClock) => {
      await checkOutboxQueueLag(injectedClock.now());
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
  const { jobType, processor, concurrency, priority } = worker;

  logger.info(`[Worker] Starting loop for ${jobType}`, {
    concurrency,
    priority,
  });

  while (running) {
    let processedCount = 0;
    try {
      // PR-75: background workers yield to interactive work. If any
      // interactive event of any type is PENDING, skip the claim this
      // cycle so latency-sensitive jobs (rent-due SMS, FCM dispatch,
      // etc.) get first dibs. The check is cheap (a single COUNT on
      // the (priority, status, createdAt) index) and only runs for
      // background workers.
      if (priority === 'background' && (await hasPendingInteractive())) {
        // Don't claim — sleep and re-check on the next tick.
        await sleep(1000);
        continue;
      }

      processedCount = await JobQueue.processJobs(
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
        concurrency,
        priority
      );
    } catch (err) {
      logger.error(`[Worker] Error in ${jobType} loop`, err);
    }

    // Adaptive idle backoff: sleep 1s when active, 15s when idle to save DB query overhead
    await sleep(processedCount > 0 ? 1000 : 15000);
  }
}

// P0-4: consecutive failure tracking for scheduled tasks
const scheduledTaskFailureCount = new Map<string, number>();

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
      scheduledTaskFailureCount.set(task.name, 0); // reset on success
    } catch (err) {
      logger.error(`[Scheduler] Error in "${task.name}"`, err);
      // P0-4: alert after 3 consecutive failures
      const failures = (scheduledTaskFailureCount.get(task.name) ?? 0) + 1;
      scheduledTaskFailureCount.set(task.name, failures);
      if (failures >= 3) {
        logger.error(`[Scheduler] ALERT: "${task.name}" has failed ${failures} consecutive times`, err);
        alerter.send({
          level: 'critical',
          title: `Scheduled task failure: ${task.name}`,
          message: `Task "${task.name}" has failed ${failures} consecutive times. Error: ${err instanceof Error ? err.message : String(err)}`,
        }).catch((e) => logger.warn('[Scheduler] Alerter call failed', e));
      }
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

/**
 * PR-75: gate background workers. Returns true if any
 * 'interactive' outbox event of any type is PENDING. Used by the
 * worker loop to skip background claims when interactive work is
 * waiting. Backs the (priority, status, createdAt) index added in
 * prisma/migrations/20260803152322_add_outbox_priority/.
 *
 * The check is intentionally cheap and slightly conservative:
 * we report a PENDING interactive event exists whenever
 * status='PENDING', even if the row's attempts >= maxAttempts
 * (would not be claimed) or readyAt is in the future (would not
 * be claimed yet). The cost is one extra sleep cycle for the
 * background worker; the benefit is a single indexed EXISTS-style
 * check (findFirst + take: 1) instead of a more expensive join.
 */
async function hasPendingInteractive(): Promise<boolean> {
  const { db } = await import('@/lib/db');
  const found = await db.outboxEvent.findFirst({
    where: {
      priority: 'interactive',
      status: 'PENDING',
    },
    select: { id: true },
  });
  return found !== null;
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
