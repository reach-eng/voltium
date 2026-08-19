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
export interface JobOutboxConfig {
  eventType: OutboxEventType;
  priority: 'interactive' | 'background';
}

export const JOB_TO_OUTBOX_CONFIG: Record<string, JobOutboxConfig> = {
  'wallet-reconciliation': {
    eventType: OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
    // Admin-triggered reconciliation is a fast single-SQL run (post-unify) —
    // interactive priority so it isn't starved behind long background jobs.
    priority: 'interactive',
  },
  'rent-due-checker': {
    eventType: OutboxEventTypes.ADMIN_JOB_RENT_DUE_CHECK,
    priority: 'interactive',
  },
  // PR-VER-2026-08-06 (EVENT_BUS P0-6): auto-debit is now its own event
  // (debit-only mode) instead of silently sharing rent-due-checker's.
  'auto-debit': {
    eventType: OutboxEventTypes.ADMIN_JOB_AUTO_DEBIT,
    priority: 'interactive',
  },
  'device-compliance': {
    eventType: OutboxEventTypes.ADMIN_JOB_DEVICE_COMPLIANCE,
    priority: 'background',
  },
  'referral-reward': {
    eventType: OutboxEventTypes.ADMIN_JOB_REFERRAL_REWARD,
    priority: 'interactive',
  },
  'notifications-cleanup': {
    eventType: OutboxEventTypes.ADMIN_JOB_NOTIFICATIONS_CLEANUP,
    priority: 'background',
  },
  'telemetry-cleanup': {
    eventType: OutboxEventTypes.ADMIN_JOB_TELEMETRY_CLEANUP,
    priority: 'background',
  },
  'daily-engagement': {
    eventType: OutboxEventTypes.ADMIN_JOB_DAILY_ENGAGEMENT,
    priority: 'background',
  },
};

/**
 * PR-B: best-effort "next run" estimator for the Background Jobs UI.
 *
 * Voltium schedules its cron jobs via textual labels like
 * "Daily (02:00 IST)" or "Hourly (at 00 mins)" or "Weekly (Sun 03:00 IST)".
 * We don't store a real cron expression (yet), so this helper parses
 * the label and returns the next plausible run time as a UTC ISO
 * string. The estimator is intentionally simple:
 *   - Daily HH:MM IST → next 24h boundary at HH:MM IST
 *   - Hourly (at MM mins) → next 60-min boundary at MM:00
 *   - Weekly (Sun HH:MM IST) → next Sunday at HH:MM IST
 *   - Monthly (1st at HH:MM IST) → next 1st of the month at HH:MM IST
 *   - On-demand → null (no scheduled run)
 *
 * If the label is unparseable, returns null. The UI falls back to
 * "—" when nextRun is null, so a parsing failure is visible but
 * non-blocking.
 */
function estimateNextRun(
  schedule: string,
  fromTime: Date = new Date()
): string | null {
  const lower = schedule.toLowerCase();
  if (lower.includes('on-demand')) return null;

  const istOffsetMs = 5.5 * 60 * 60 * 1000;

  const toIst = (d: Date) => new Date(d.getTime() + istOffsetMs);
  const toIstIso = (d: Date) => toIst(d).toISOString().replace('Z', '+05:30');
  const fromIst = toIst(fromTime);

  // Match "Daily (HH:MM IST)" or "Daily (HH:MM)"
  const dailyMatch = lower.match(/daily\s*\(?(\d{1,2}):(\d{2})/);
  if (dailyMatch) {
    const target = new Date(fromIst);
    target.setUTCHours(parseInt(dailyMatch[1], 10), parseInt(dailyMatch[2], 10), 0, 0);
    if (target.getTime() <= fromIst.getTime()) {
      target.setUTCDate(target.getUTCDate() + 1);
    }
    return toIstIso(new Date(target.getTime() - istOffsetMs));
  }

  // Match "Hourly (at MM mins)"
  const hourlyMatch = lower.match(/hourly\s*\(?at\s*(\d{1,2})\s*mins?\)?/);
  if (hourlyMatch) {
    const target = new Date(fromIst);
    target.setUTCMinutes(parseInt(hourlyMatch[1], 10), 0, 0);
    if (target.getTime() <= fromIst.getTime()) {
      target.setUTCHours(target.getUTCHours() + 1);
    }
    return toIstIso(new Date(target.getTime() - istOffsetMs));
  }

  // Match "Weekly (Sun HH:MM IST)"
  const weeklyMatch = lower.match(/weekly\s*\(?(sun|mon|tue|wed|thu|fri|sat)\w*\s*(\d{1,2}):(\d{2})/);
  if (weeklyMatch) {
    const dayMap: Record<string, number> = {
      sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
    };
    const targetDay = dayMap[weeklyMatch[1].slice(0, 3)];
    const target = new Date(fromIst);
    target.setUTCHours(parseInt(weeklyMatch[2], 10), parseInt(weeklyMatch[3], 10), 0, 0);
    const currentDay = target.getUTCDay();
    const daysAhead = (targetDay - currentDay + 7) % 7;
    target.setUTCDate(target.getUTCDate() + daysAhead);
    if (daysAhead === 0 && target.getTime() <= fromIst.getTime()) {
      target.setUTCDate(target.getUTCDate() + 7);
    }
    return toIstIso(new Date(target.getTime() - istOffsetMs));
  }

  // Match "Monthly (1st at HH:MM IST)"
  const monthlyMatch = lower.match(/monthly\s*\(?(\d{1,2})(?:st|nd|rd|th)?\s*at\s*(\d{1,2}):(\d{2})/);
  if (monthlyMatch) {
    const target = new Date(fromIst);
    target.setUTCDate(parseInt(monthlyMatch[1], 10));
    target.setUTCHours(parseInt(monthlyMatch[2], 10), parseInt(monthlyMatch[3], 10), 0, 0);
    if (target.getTime() <= fromIst.getTime()) {
      target.setUTCMonth(target.getUTCMonth() + 1);
      target.setUTCDate(parseInt(monthlyMatch[1], 10));
    }
    return toIstIso(new Date(target.getTime() - istOffsetMs));
  }

  return null;
}

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) {
      return errors.unauthorized('Admin authentication required');
    }

    if (!hasPermission(admin.adminRole || '', 'jobs_view')) {
      return errors.forbidden('Forbidden: jobs_view permission required');
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
    // PR-B: each entry now exposes `lastError` (the `error` field
    // stored in the `job:last_run:*` SystemSetting JSON) and
    // `nextRun` (an estimator from the textual schedule label).
    // The UI uses these to show a "what failed last time" row and
    // "next run" pill per job card.
    const now = new Date();
    const jobs = [
      {
        id: 'wallet-reconciliation',
        name: 'Wallet Reconciliation',
        schedule: 'Daily (02:00 IST)',
        purpose: 'Compare ledger sum vs wallet balance for all riders and identify drifts.',
        lastRun: reconHistory[0] ? reconHistory[0].createdAt : lastRuns['wallet-reconciliation']?.timestamp || null,
        lastStatus: reconHistory[0] ? (reconHistory[0].mismatched === 0 ? 'SUCCESS' : 'FAILED') : lastRuns['wallet-reconciliation']?.status || 'NEVER',
        details: reconHistory[0] ? `${reconHistory[0].matched} matched, ${reconHistory[0].mismatched} mismatched, drift: ₹${(reconHistory[0].drift / 100).toFixed(2)}` : null,
        lastError: lastRuns['wallet-reconciliation']?.error || null,
        nextRun: estimateNextRun('Daily (02:00 IST)', now),
      },
      {
        id: 'rent-due-checker',
        name: 'Rent Due Checker',
        schedule: 'Daily (00:00 IST)',
        purpose: 'Detect and notify overdue rentals.',
        lastRun: lastRuns['rent-due-checker']?.timestamp || null,
        lastStatus: lastRuns['rent-due-checker']?.status || 'NEVER',
        details: lastRuns['rent-due-checker']?.details || null,
        lastError: lastRuns['rent-due-checker']?.error || null,
        nextRun: estimateNextRun('Daily (00:00 IST)', now),
      },
      {
        id: 'auto-debit',
        name: 'Auto-Debit',
        schedule: 'Daily (01:00 IST)',
        purpose: 'Attempt wallet debit for due rent.',
        lastRun: lastRuns['auto-debit']?.timestamp || null,
        lastStatus: lastRuns['auto-debit']?.status || 'NEVER',
        details: lastRuns['auto-debit']?.details || null,
        lastError: lastRuns['auto-debit']?.error || null,
        nextRun: estimateNextRun('Daily (01:00 IST)', now),
      },
      {
        id: 'device-compliance',
        name: 'Device Compliance',
        schedule: 'Hourly (at 00 mins)',
        purpose: 'Check active riders for compliance violations (location, uninstall block, overlay).',
        lastRun: lastRuns['device-compliance']?.timestamp || null,
        lastStatus: lastRuns['device-compliance']?.status || 'NEVER',
        details: lastRuns['device-compliance']?.details || null,
        lastError: lastRuns['device-compliance']?.error || null,
        nextRun: estimateNextRun('Hourly (at 00 mins)', now),
      },
      {
        id: 'referral-reward',
        name: 'Referral Reward',
        schedule: 'On-demand / Daily',
        purpose: 'Process referral rewards for referrers once referee becomes active.',
        lastRun: lastRuns['referral-reward']?.timestamp || null,
        lastStatus: lastRuns['referral-reward']?.status || 'NEVER',
        details: lastRuns['referral-reward']?.details || null,
        lastError: lastRuns['referral-reward']?.error || null,
        nextRun: estimateNextRun('On-demand / Daily', now),
      },
      {
        id: 'notifications-cleanup',
        name: 'Notification Cleanup',
        schedule: 'Weekly (Sun 03:00 IST)',
        purpose: 'Purge old read notifications (older than 30 days).',
        lastRun: lastRuns['notifications-cleanup']?.timestamp || null,
        lastStatus: lastRuns['notifications-cleanup']?.status || 'NEVER',
        details: lastRuns['notifications-cleanup']?.details || null,
        lastError: lastRuns['notifications-cleanup']?.error || null,
        nextRun: estimateNextRun('Weekly (Sun 03:00 IST)', now),
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
        lastError: lastRuns['daily-engagement']?.error || null,
        nextRun: estimateNextRun('Daily (06:00 IST)', now),
      },
      {
        id: 'telemetry-cleanup',
        name: 'Telemetry Cleanup',
        schedule: 'Monthly (1st at 04:00 IST)',
        purpose: 'Purge old location and call log data (older than 30 days).',
        lastRun: lastRuns['telemetry-cleanup']?.timestamp || null,
        lastStatus: lastRuns['telemetry-cleanup']?.status || 'NEVER',
        details: lastRuns['telemetry-cleanup']?.details || null,
        lastError: lastRuns['telemetry-cleanup']?.error || null,
        nextRun: estimateNextRun('Monthly (1st at 04:00 IST)', now),
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

    const jobConfig = JOB_TO_OUTBOX_CONFIG[jobId];
    if (!jobConfig) {
      return errors.badRequest(`Unknown jobId: ${jobId}`);
    }

    // PR-89 (API N3): enqueue instead of run. The job is fire-and-forget
    // from the API's perspective — a successful emit is the contract.
    // If the emit itself fails, fall back to a 500 with a generic
    // message (PR-89 (API N3) stops interpolating err.message).
    const outboxId = await OutboxService.emit(
      jobConfig.eventType,
      {
        jobId,
        triggeredBy: admin.adminId ?? 'unknown',
        triggeredAt: new Date().toISOString(),
      },
      3,
      undefined,
      jobConfig.priority
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
      details: JSON.stringify({ jobId, eventType: jobConfig.eventType }),
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
