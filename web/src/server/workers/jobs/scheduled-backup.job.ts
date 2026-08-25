import { db } from '@/lib/db';
import { type QueueJob } from '@/lib/job-queue';
import { logger } from '@/lib/logger';
import { clock } from '@/lib/clock';
import { backupRepository } from '@/server/modules/data-management/backup.repository';
import { scheduleService } from '@/server/modules/data-management/schedule/schedule.service';
import { backupService, getFreeDiskBytes } from '@/server/modules/data-management/backup.service';
import { createAuditLog } from '@/lib/audit-log';

/**
 * P0-7 (ops audit): recompute the next run for a schedule whose `nextRunAt`
 * was wiped (DR drill / schedule reset). Delegates to the canonical
 * `scheduleService.calculateNextRun` — the helper the interrupted pass
 * referenced as `computeNextRunAt` without ever defining.
 *
 * Falls back to next daily 02:00 for MANUAL/DISABLED/unparseable schedules so
 * the schedule never stalls permanently.
 */
function computeNextRunAt(
  frequency: string | null,
  timeOfDay: string | null,
  now: Date
): Date {
  const next = scheduleService.calculateNextRun({
    frequency: frequency ?? undefined,
    timeOfDay: timeOfDay ?? undefined,
    baseDate: now,
  });
  if (next) return next;
  const fallback = new Date(now);
  fallback.setHours(2, 0, 0, 0);
  if (fallback <= now) fallback.setDate(fallback.getDate() + 1);
  return fallback;
}

export const scheduledBackupJob = {
  /**
   * Outbox worker entry point for ADMIN_JOB_SCHEDULED_BACKUP events.
   * Handles admin-triggered manual backups, schedule triggers, and regular checks.
   */
  async process(job?: { id?: string; payload?: unknown }): Promise<{ ran: boolean; reason?: string }> {
    const payload = (job?.payload ?? {}) as {
      type?: 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
      scheduleId?: string;
      adminId?: string;
      triggeredBy?: string;
    };

    if (payload.type === 'MANUAL' || payload.type === 'PRE_RESTORE') {
      try {
        await backupService.createBackup({
          type: payload.type,
          adminId: payload.adminId,
          notes: payload.type === 'MANUAL' ? 'Manual backup triggered by admin' : 'Pre-restore snapshot',
        });
        return { ran: true };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error('[ScheduledBackup] Manual backup worker failed', err);
        return { ran: false, reason: errorMsg };
      }
    }

    return scheduledBackupJob.checkAndRun();
  },

  async checkAndRun(): Promise<{ ran: boolean; reason?: string }> {
    try {
      const schedule = await backupRepository.getSchedule();
      if (!schedule) {
        return { ran: false, reason: 'No schedule configured' };
      }

      if (!schedule.enabled) {
        return { ran: false, reason: 'Schedule is disabled' };
      }

      // Check if a backup or restore is already running
      const running = await backupRepository.findRunningBackup();
      if (running) {
        return { ran: false, reason: 'A backup is already in progress' };
      }

      // Check maintenance mode
      const maintenanceSetting = await db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } });
      if (maintenanceSetting?.value === 'true') {
        return { ran: false, reason: 'Maintenance mode is active' };
      }

      // Check backup lock — a restore operation may be in progress
      const backupLock = await db.systemSetting.findUnique({ where: { key: 'BACKUP_LOCK_STATUS' } });
      if (backupLock?.value === 'RESTORE_RUNNING') {
        return { ran: false, reason: 'Restore operation is in progress — backup skipped' };
      }

      // Check disk space
      const freeBytes = await getFreeDiskBytes();
      const freeGb = freeBytes / (1024 * 1024 * 1024);
      if (freeGb < schedule.minimumFreeDiskGb) {
        logger.warn('[ScheduledBackup] Insufficient disk space', {
          freeGb: freeGb.toFixed(1),
          minimum: schedule.minimumFreeDiskGb,
        });
        await backupRepository.markScheduleFailure(
          schedule.id,
          `Insufficient disk space: ${freeGb.toFixed(1)} GB free`
        );
        return { ran: false, reason: 'Insufficient disk space' };
      }

      // Check if backup is due
      const now = clock.now();
      if (!schedule.nextRunAt) {
        // P0-7: DR drill / schedule reset wiped nextRunAt — re-initialize and proceed
        const nextRunAt = computeNextRunAt(schedule.frequency, schedule.timeOfDay, now);
        await backupRepository.markScheduleSuccess(schedule.id, now, nextRunAt);
        logger.info('[ScheduledBackup] Re-initialized null nextRunAt', { nextRunAt: nextRunAt.toISOString() });
      } else if (now < schedule.nextRunAt) {
        return {
          ran: false,
          reason: `Next backup scheduled at ${schedule.nextRunAt.toISOString()}`,
        };
      }

      // It's due — run the backup
      logger.info('[ScheduledBackup] Running scheduled backup', {
        frequency: schedule.frequency,
        timeOfDay: schedule.timeOfDay,
      });

      await createAuditLog({
        actorId: 'SYSTEM',
        actorType: 'SYSTEM',
        action: 'SYSTEM_JOB',
        entity: 'BackupSchedule',
        entityId: schedule.id,
        details: { event: 'backup.scheduled_started' },
      });

      try {
        await backupService.runScheduledBackup({
          id: schedule.id,
          frequency: schedule.frequency,
          includeDatabase: schedule.includeDatabase,
          includeUploads: schedule.includeUploads,
          includeLogs: schedule.includeLogs,
          primaryBackupRoot: schedule.primaryBackupRoot,
          secondaryBackupRoot: schedule.secondaryBackupRoot,
          keepDaily: schedule.keepDaily,
          keepWeekly: schedule.keepWeekly,
          keepMonthly: schedule.keepMonthly,
          keepManual: schedule.keepManual,
          minimumFreeDiskGb: schedule.minimumFreeDiskGb,
        });

        // Calculate next run time
        const nextRunAt = scheduleService.calculateNextRun(schedule);
        // T-92 (PR-2, 2026-08-23): `calculateNextRun` returns `null`
        // for MANUAL frequency or unparseable `timeOfDay`. The
        // previous code did `nextRunAt ?? clock.now()`, which
        // converted `null` to "now" and turned the schedule into
        // a tight loop that filled the disk with backup files
        // (every minute the worker ticked, the schedule was
        // "due now" again). Persist `nextRunAt = null` and
        // DON'T reschedule — the schedule stays dormant until an
        // admin updates the frequency / timeOfDay. The admin
        // Schedules UI surfaces the un-runnable schedule in the
        // "Needs attention" section.
        if (nextRunAt === null) {
          logger.warn(
            '[ScheduledBackup] calculateNextRun returned null — schedule is not auto-runnable',
            { scheduleId: schedule.id, frequency: schedule.frequency }
          );
        }
        await backupRepository.markScheduleSuccess(
          schedule.id,
          clock.now(),
          nextRunAt
        );

        // Clear any previous failure alert
        // PR-VER-2026-08-07 (CRON/DB): `category` became a required column on
        // SystemSetting (settings-registry work) — the old create omitted it
        // and crashed at runtime with a Prisma validation error.
        await db.systemSetting
          .upsert({
            where: { key: 'LAST_BACKUP_FAILURE' },
            update: { value: '' },
            create: { key: 'LAST_BACKUP_FAILURE', value: '', category: 'OPERATIONAL' },
          })
          .catch(() => {});

        // PR-45 (CRON P0-4): clear the consecutive-failure counter on
        // a successful backup so a one-off blip doesn't keep the
        // Slack alert armed.
        await db.systemSetting
          .upsert({
            where: { key: 'CONSECUTIVE_BACKUP_FAILURES' },
            update: { value: '0' },
            create: { key: 'CONSECUTIVE_BACKUP_FAILURES', value: '0', category: 'OPERATIONAL' },
          })
          .catch(() => {});

        return { ran: true };
      } catch (backupErr) {
        const errorMsg = (backupErr instanceof Error ? backupErr.message : String(backupErr));
        logger.error('[ScheduledBackup] Backup execution failed', backupErr);
        await backupRepository.markScheduleFailure(schedule.id, errorMsg);

        // PR-45 (CRON P0-4): on a failure, increment a per-process
        // counter. When the counter crosses the threshold (3 in a
        // row) we fire a Slack alert so the on-call engineer gets
        // paged BEFORE the disk fills up or the schedule silently
        // drifts. The counter resets on the next success.
        const ALERT_THRESHOLD = 3;
        try {
          const counterRow = await db.systemSetting.findUnique({
            where: { key: 'CONSECUTIVE_BACKUP_FAILURES' },
          });
          const previous = parseInt(counterRow?.value ?? '0', 10) || 0;
          const next = previous + 1;
          await db.systemSetting.upsert({
            where: { key: 'CONSECUTIVE_BACKUP_FAILURES' },
            update: { value: String(next) },
            create: {
              key: 'CONSECUTIVE_BACKUP_FAILURES',
              value: String(next),
              category: 'OPERATIONAL',
            },
          });
          if (next >= ALERT_THRESHOLD && previous < ALERT_THRESHOLD) {
            // Crossed the threshold for the first time in this streak —
            // fire a Slack alert. Subsequent failures in the same
            // streak are intentionally silent to avoid alert spam.
            const { alerter } = await import('@/lib/alerter');
            await alerter.send({
              level: 'critical',
              title: '🚨 Scheduled backup failing',
              message:
                `Scheduled backup has failed ${next} times in a row. ` +
                `Last error: ${errorMsg.slice(0, 200)}`,
              source: 'workers/jobs/scheduled-backup.job',
            });
            logger.warn(
              '[ScheduledBackup] Slack alert fired — consecutive failures crossed threshold',
              { consecutiveFailures: next },
            );
          }
        } catch (alertErr) {
          // The counter / alert path must never break the schedule —
          // the failure is already recorded in `markScheduleFailure`.
          logger.error('[ScheduledBackup] Failed to record/alert on failure', alertErr);
        }

        return { ran: false, reason: `Backup execution failed: ${errorMsg}` };
      }
    } catch (err) {
      logger.error('[ScheduledBackup] Job check failed', err);
      return { ran: false, reason: 'Job check failed' };
    }
  },
};
