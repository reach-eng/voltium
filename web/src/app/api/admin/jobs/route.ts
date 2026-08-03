import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { requireAdmin } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { db } from '@/lib/db';
import { OutboxEventTypes, OutboxService, OutboxEventType } from '@/server/workers/outbox';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';

/**
 * PR-89 (API N3) — admin-triggered background jobs are now asynchronous.
 *
 * Each POST to this route enqueues a single outbox event keyed to the
 * jobId. The route returns 202 immediately so the admin UI does not
 * block on a long-running reconciliation or a fleet-wide compliance
 * scan. Workers pick the event up from the outbox table; the existing
 * `job:last_run:*` SystemSetting keys are still updated by the worker
 * after a successful run, so the GET-side view is unchanged.
 *
 * Mapping from jobId → outbox event type. New types are added in
 * `outbox.ts` (PR-89 (API N3)). The mapping is a const so a typo at
 * one site is a compile error.
 */
const JOB_TO_OUTBOX_EVENT: Record<string, OutboxEventType> = {
  'wallet-reconciliation': OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
  'rent-due-checker': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
  'auto-debit': OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
  'device-compliance': OutboxEventTypes.ADMIN_JOB_DEVICE_COMPLIANCE,
  'referral-reward': OutboxEventTypes.ADMIN_JOB_REFERRAL_REWARD,
  'notifications-cleanup': OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP,
  'telemetry-cleanup': OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP,
  'daily-engagement': OutboxEventTypes.ADMIN_JOB_DAILY_ENGAGEMENT,
};

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }

    // 1. Get reconciliation reports history
    const reconHistory = await db.reconciliationReport.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // 2. Fetch last runs of all jobs from SystemSetting table
    const jobSettings = await db.systemSetting.findMany({
      where: {
        key: { startsWith: 'job:last_run:' },
      },
    });

    const lastRuns: Record<string, any> = {};
    jobSettings.forEach((s: any) => {
      try {
        const name = s.key.replace('job:last_run:', '');
        lastRuns[name] = JSON.parse(s.value);
      } catch {
        // ignore
      }
    });

    // 3. Define the list of 7 background jobs with their details
    const jobs = [
      {
        id: 'wallet-reconciliation',
        name: 'Wallet Reconciliation',
        schedule: 'Daily (02:00 IST)',
        purpose: 'Compare ledger sum vs wallet balance for all riders and identify drifts.',
        lastRun: reconHistory[0] ? reconHistory[0].createdAt : lastRuns['wallet-reconciliation']?.timestamp || null,
        lastStatus: reconHistory[0] ? (reconHistory[0].mismatched === 0 ? 'SUCCESS' : 'FAILED') : lastRuns['wallet-reconciliation']?.status || 'NEVER',
        details: reconHistory[0] ? `${reconHistory[0].matched} matched, ${reconHistory[0].mismatched} mismatched, drift: ₹${(reconHistory[0].drift / 100).toFixed(2)}` : null,
      },
      {
        id: 'rent-due-checker',
        name: 'Rent Due Checker',
        schedule: 'Daily (00:00 IST)',
        purpose: 'Detect and notify overdue rentals.',
        lastRun: lastRuns['rent-due-checker']?.timestamp || null,
        lastStatus: lastRuns['rent-due-checker']?.status || 'NEVER',
        details: lastRuns['rent-due-checker']?.details || null,
      },
      {
        id: 'auto-debit',
        name: 'Auto-Debit',
        schedule: 'Daily (01:00 IST)',
        purpose: 'Attempt wallet debit for due rent.',
        lastRun: lastRuns['auto-debit']?.timestamp || null,
        lastStatus: lastRuns['auto-debit']?.status || 'NEVER',
        details: lastRuns['auto-debit']?.details || null,
      },
      {
        id: 'device-compliance',
        name: 'Device Compliance',
        schedule: 'Hourly (at 00 mins)',
        purpose: 'Check active riders for compliance violations (location, uninstall block, overlay).',
        lastRun: lastRuns['device-compliance']?.timestamp || null,
        lastStatus: lastRuns['device-compliance']?.status || 'NEVER',
        details: lastRuns['device-compliance']?.details || null,
      },
      {
        id: 'referral-reward',
        name: 'Referral Reward',
        schedule: 'On-demand / Daily',
        purpose: 'Process referral rewards for referrers once referee becomes active.',
        lastRun: lastRuns['referral-reward']?.timestamp || null,
        lastStatus: lastRuns['referral-reward']?.status || 'NEVER',
        details: lastRuns['referral-reward']?.details || null,
      },
      {
        id: 'notifications-cleanup',
        name: 'Notification Cleanup',
        schedule: 'Weekly (Sun 03:00 IST)',
        purpose: 'Purge old read notifications (older than 30 days).',
        lastRun: lastRuns['notifications-cleanup']?.timestamp || null,
        lastStatus: lastRuns['notifications-cleanup']?.status || 'NEVER',
        details: lastRuns['notifications-cleanup']?.details || null,
      },
      {
        // BLOCKER 1.4: new daily engagement worker at 06:00 IST.
        id: 'daily-engagement',
        name: 'Daily Engagement',
        schedule: 'Daily (06:00 IST)',
        purpose: 'Birthday wishes + payment reminders + referral leaderboard.',
        lastRun: lastRuns['daily-engagement']?.timestamp || null,
        lastStatus: lastRuns['daily-engagement']?.status || 'NEVER',
        details: lastRuns['daily-engagement']?.details || null,
      },
      {
        id: 'telemetry-cleanup',
        name: 'Telemetry Cleanup',
        schedule: 'Monthly (1st at 04:00 IST)',
        purpose: 'Purge old location and call log data (older than 30 days).',
        lastRun: lastRuns['telemetry-cleanup']?.timestamp || null,
        lastStatus: lastRuns['telemetry-cleanup']?.status || 'NEVER',
        details: lastRuns['telemetry-cleanup']?.details || null,
      },
    ];

    return withCacheHeaders(
      success({
        jobs,
        reconHistory,
      }),
      5
    );
  } catch (err: unknown) {
    return errors.internal('Failed to load jobs list');
  }
}

export async function POST(req: NextRequest) {
  let body: any = null;
  let admin: any = null;
  let jobId: string | undefined;

  try {
    admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }
    // PR-58: require the `jobs_run` permission, not just `requireAdmin`.
    // A READ_ONLY admin passes the role check but should not be able
    // to fire `auto-debit`, `daily-engagement`, or
    // `wallet-reconciliation`. SUPER_ADMIN still passes via the
    // implicit bypass in `hasPermission` (permissions.ts:75).
    if (!hasPermission(admin.adminRole || '', 'jobs_run')) {
      return errors.forbidden('Forbidden: jobs_run permission required');
    }

    body = await req.json();
    jobId = body?.jobId;

    if (!jobId) {
      return errors.badRequest('jobId is required');
    }

    const eventType = JOB_TO_OUTBOX_EVENT[jobId];
    if (!eventType) {
      return errors.badRequest(`Unknown jobId: ${jobId}`);
    }

    // PR-89 (API N3): enqueue instead of run. The job is fire-and-forget
    // from the API's perspective — a successful emit is the contract.
    // If the emit itself fails, fall back to a 500 with a generic
    // message (PR-89 (API N3) stops interpolating err.message).
    const outboxId = await OutboxService.emit(
      eventType,
      {
        jobId,
        triggeredBy: admin.adminId ?? 'unknown',
        triggeredAt: new Date().toISOString(),
      },
      3,
      undefined,
      'interactive'
    );

    // PR-89 (API N3): audit the trigger so the admin/jobs endpoint
    // is still traceable from the SOC2 audit trail. The worker will
    // also write its own audit row when it actually executes the job.
    createAuditLog({
      actorId: admin.adminId ?? 'unknown',
      actorType: 'ADMIN',
      action: 'admin_job_trigger',
      entity: 'outbox_event',
      entityId: outboxId,
      details: JSON.stringify({ jobId, eventType }),
    }).catch(() => {});

    return success(
      {
        jobId,
        jobId_outboxId: outboxId,
        details: 'Queued',
      },
      'Job execution queued',
      202
    );
  } catch (err: unknown) {
    // PR-89 (API N3): never interpolate err.message into the
    // response body. Log the detail for the operator and return a
    // generic message so internal failure modes don't leak.
    logger.error('Admin job enqueue failed', {
      jobId,
      adminId: admin?.adminId,
      err: err instanceof Error ? { message: err.message, stack: err.stack } : err,
    });
    return errors.internal('Job failed');
  }
}
