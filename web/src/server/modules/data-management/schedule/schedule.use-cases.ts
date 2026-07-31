import { backupRepository } from '../backup/backup.repository';
import { scheduleService } from './schedule.service';
import { backupPolicy } from '../backup/backup.policy';
import type { AdminRole } from '../../admin/admin.types';
import type { BackupScheduleConfig } from '../backup/backup.types';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { AuthError, ValidationError } from "@/lib/api-error";
import { existsSync, mkdirSync } from 'fs';

export const scheduleUseCases = {
  async getSchedule(adminRole: AdminRole): Promise<BackupScheduleConfig | null> {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const schedule = await backupRepository.getSchedule();
    if (!schedule) return null;

    return {
      id: schedule.id,
      enabled: schedule.enabled,
      frequency: schedule.frequency as BackupScheduleConfig['frequency'],
      timeOfDay: schedule.timeOfDay,
      timezone: schedule.timezone,
      dayOfWeek: schedule.dayOfWeek,
      dayOfMonth: schedule.dayOfMonth,
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
      lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
      nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
      lastStatus: schedule.lastStatus,
      lastError: schedule.lastError,
    };
  },

  async updateSchedule(
    config: Omit<BackupScheduleConfig, 'id' | 'lastRunAt' | 'nextRunAt' | 'lastStatus' | 'lastError'>,
    adminId: string,
    adminRole: AdminRole
  ) {
    if (!backupPolicy.canManageSchedule(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const nextRunAt = scheduleService.calculateNextRun({
      frequency: config.frequency,
      timeOfDay: config.timeOfDay,
      timezone: config.timezone,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
    });

    const schedule = await backupRepository.upsertSchedule({
      ...config,
      nextRunAt,
      updatedByAdminId: adminId,
    });

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'backup.schedule_updated',
      entity: 'BackupSchedule',
      entityId: schedule.id,
      details: {
        frequency: config.frequency,
        enabled: config.enabled,
        nextRunAt: nextRunAt?.toISOString(),
      },
    });

    return schedule;
  },

  async testSchedule(adminRole: AdminRole) {
    if (!backupPolicy.canManageSchedule(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const schedule = await backupRepository.getSchedule();
    if (!schedule) {
      throw new ValidationError('No backup schedule configured. Save schedule settings first.');
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    if (!existsSync(schedule.primaryBackupRoot)) {
      try {
        mkdirSync(schedule.primaryBackupRoot, { recursive: true });
        warnings.push('Primary backup folder did not exist — created automatically');
      } catch {
        issues.push(`Cannot create primary backup folder: ${schedule.primaryBackupRoot}`);
      }
    }

    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      issues.push('Database is not reachable');
    }

    const uploadsRoot = process.env.LOCAL_STORAGE_ROOT || '';
    if (uploadsRoot && !existsSync(uploadsRoot)) {
      warnings.push('Uploads folder does not exist — backups will have no files');
    }

    const { getFreeDiskBytes } = await import('../storage/storage.service');
    const freeBytes = getFreeDiskBytes();
    const freeGb = freeBytes / (1024 * 1024 * 1024);
    if (freeGb < schedule.minimumFreeDiskGb) {
      warnings.push(
        `Low disk space: ${freeGb.toFixed(1)} GB free (minimum: ${schedule.minimumFreeDiskGb} GB)`
      );
    }

    if (schedule.secondaryBackupRoot) {
      if (!existsSync(schedule.secondaryBackupRoot)) {
        try {
          mkdirSync(schedule.secondaryBackupRoot, { recursive: true });
          warnings.push('Secondary backup folder did not exist — created automatically');
        } catch {
          warnings.push(`Cannot create secondary backup folder: ${schedule.secondaryBackupRoot}`);
        }
      }
    }

    await createAuditLog({
      actorId: 'SYSTEM',
      actorType: 'SYSTEM',
      action: 'backup.schedule_tested',
      entity: 'BackupSchedule',
      entityId: schedule.id,
      details: { issues: issues.length, warnings: warnings.length },
    });

    return {
      success: issues.length === 0,
      issues,
      warnings,
      freeDiskGb: freeGb,
      backupPath: schedule.primaryBackupRoot,
      secondaryPath: schedule.secondaryBackupRoot,
    };
  },

  async runScheduledBackupNow(adminId: string, adminRole: AdminRole) {
    if (!backupPolicy.canManageSchedule(adminRole)) {
      throw new AuthError('Unauthorized');
    }

    const schedule = await backupRepository.getSchedule();
    if (!schedule) {
      throw new ValidationError('No backup schedule configured');
    }

    const running = await backupRepository.findRunningBackup();
    if (running) {
      throw new ValidationError('A backup is already in progress');
    }

    const maintenanceSetting = await db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } });
    if (maintenanceSetting?.value === 'true') {
      throw new ValidationError('Cannot run backup while maintenance mode is active');
    }

    const { backupLockService } = await import('../backup/backup-lock.service');
    const lock = await backupLockService.getLockStatus();
    if (lock.status !== 'NONE') {
      throw new ValidationError(
        `Cannot run backup while lock is active (${lock.status} held by ${lock.owner})`
      );
    }

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'backup.scheduled_started',
      entity: 'BackupSchedule',
      entityId: schedule.id,
    });

    try {
      const result = await scheduleService.runScheduledBackup({
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

      const nextRunAt = scheduleService.calculateNextRun({
        frequency: schedule.frequency,
        timeOfDay: schedule.timeOfDay,
        timezone: schedule.timezone,
        dayOfWeek: schedule.dayOfWeek,
        dayOfMonth: schedule.dayOfMonth,
      });

      await backupRepository.markScheduleSuccess(schedule.id, new Date(), nextRunAt ?? new Date());

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'backup.scheduled_completed',
        entity: 'BackupJob',
        entityId: result.id,
        details: { backupId: result.backupId, sizeBytes: result.sizeBytes },
      });

      return result;
    } catch (err: unknown) {
      await backupRepository.markScheduleFailure(schedule.id, (err instanceof Error ? err.message : String(err)));

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'backup.scheduled_failed',
        entity: 'BackupSchedule',
        entityId: schedule.id,
        details: { error: (err instanceof Error ? err.message : String(err)) },
      });

      throw err;
    }
  }
};
