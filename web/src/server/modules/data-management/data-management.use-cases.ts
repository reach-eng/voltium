/**
 * Data Management — Use Cases
 *
 * Orchestrates business logic for the Data Management admin section.
 * All operations are local-disk based — no cloud storage.
 */

import { existsSync, mkdirSync } from 'fs';
import { backupRepository } from './backup.repository';
import { backupService, calculateNextRun, getFreeDiskBytes } from './backup.service';
import { restoreService } from './restore.service';
import { backupPolicy } from './backup.policy';
import type { AdminRole } from '../admin/admin.types';
import type { BackupScheduleConfig, StorageOverview } from './backup.types';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

export const dataManagementUseCases = {
  async getOverview(adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new Error('Unauthorized');
    }

    const [stats, latestBackup, storage] = await Promise.all([
      backupRepository.getBackupStats(),
      backupRepository.getLatestBackup(),
      backupService.getStorageOverview(),
    ]);

    // Get maintenance mode status
    let maintenanceMode = false;
    try {
      const setting = await db.setting.findUnique({ where: { key: 'maintenanceMode' } });
      maintenanceMode = setting?.value === 'true';
    } catch {}

    // Get schedule info
    let scheduleStatus = null;
    try {
      const schedule = await backupRepository.getSchedule();
      if (schedule) {
        scheduleStatus = {
          enabled: schedule.enabled,
          nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
          lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
          lastStatus: schedule.lastStatus,
          lastError: schedule.lastError,
        };
      }
    } catch {}

    return { stats, latestBackup, storage, maintenanceMode, scheduleStatus };
  },

  async listBackups(params: {
    page: number;
    limit: number;
    type?: string;
    status?: string;
    adminRole: AdminRole;
  }) {
    if (!backupPolicy.canViewBackups(params.adminRole)) {
      throw new Error('Unauthorized');
    }

    return backupRepository.listBackupJobs({
      page: params.page,
      limit: params.limit,
      type: params.type,
      status: params.status,
    });
  },

  async createBackup(params: {
    type: 'MANUAL' | 'SCHEDULED' | 'PRE_RESTORE';
    adminId?: string;
    adminRole: AdminRole;
  }) {
    if (!backupPolicy.canCreateBackup(params.adminRole)) {
      throw new Error('Unauthorized');
    }

    return backupService.createBackup({
      type: params.type,
      adminId: params.adminId,
    });
  },

  async getBackupDetails(backupId: string, adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new Error('Unauthorized');
    }

    const job = await backupRepository.getBackupJob(backupId);
    if (!job) throw new Error('Backup not found');

    return job;
  },

  async verifyBackup(backupId: string, adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new Error('Unauthorized');
    }

    return backupService.verifyBackup(backupId);
  },

  async downloadBackup(backupId: string, adminRole: AdminRole) {
    if (!backupPolicy.canDownloadBackup(adminRole)) {
      throw new Error('Unauthorized');
    }

    const job = await backupRepository.getBackupJob(backupId);
    if (!job) throw new Error('Backup not found');
    if (!job.databasePath || !existsSync(job.databasePath)) {
      throw new Error('Backup files not found on disk');
    }

    return job;
  },

  async deleteBackup(backupId: string, adminRole: AdminRole, adminId: string) {
    if (!backupPolicy.canDeleteBackup(adminRole)) {
      throw new Error('Unauthorized');
    }

    await backupService.deleteBackup(backupId);

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'backup.deleted',
      entity: 'BackupJob',
      entityId: backupId,
    });
  },

  async validateRestore(backupId: string, adminId: string, adminRole: AdminRole) {
    if (!backupPolicy.canRestoreBackup(adminRole)) {
      throw new Error('Unauthorized');
    }

    return restoreService.validate(backupId, adminId);
  },

  async startRestore(backupId: string, adminId: string, adminRole: AdminRole) {
    if (!backupPolicy.canRestoreBackup(adminRole)) {
      throw new Error('Unauthorized');
    }

    return restoreService.startRestore(backupId, adminId);
  },

  async getSchedule(adminRole: AdminRole): Promise<BackupScheduleConfig | null> {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new Error('Unauthorized');
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
      throw new Error('Unauthorized');
    }

    // Calculate next run time
    const nextRunAt = calculateNextRun({
      frequency: config.frequency,
      timeOfDay: config.timeOfDay,
      timezone: config.timezone,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
    });

    const schedule = await backupRepository.upsertSchedule({
      enabled: config.enabled,
      frequency: config.frequency,
      timeOfDay: config.timeOfDay,
      timezone: config.timezone,
      dayOfWeek: config.dayOfWeek,
      dayOfMonth: config.dayOfMonth,
      includeDatabase: config.includeDatabase,
      includeUploads: config.includeUploads,
      includeLogs: config.includeLogs,
      primaryBackupRoot: config.primaryBackupRoot,
      secondaryBackupRoot: config.secondaryBackupRoot,
      keepDaily: config.keepDaily,
      keepWeekly: config.keepWeekly,
      keepMonthly: config.keepMonthly,
      keepManual: config.keepManual,
      minimumFreeDiskGb: config.minimumFreeDiskGb,
      nextRunAt,
      updatedByAdminId: adminId,
    });

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'backup.schedule_updated',
      entity: 'BackupSchedule',
      entityId: schedule.id,
      details: { frequency: config.frequency, enabled: config.enabled, nextRunAt: nextRunAt?.toISOString() },
    });

    return schedule;
  },

  async testSchedule(adminRole: AdminRole) {
    if (!backupPolicy.canManageSchedule(adminRole)) {
      throw new Error('Unauthorized');
    }

    const schedule = await backupRepository.getSchedule();
    if (!schedule) {
      throw new Error('No backup schedule configured. Save schedule settings first.');
    }

    const issues: string[] = [];
    const warnings: string[] = [];

    // Check primary backup folder
    if (!existsSync(schedule.primaryBackupRoot)) {
      try {
        mkdirSync(schedule.primaryBackupRoot, { recursive: true });
        warnings.push('Primary backup folder did not exist — created automatically');
      } catch {
        issues.push(`Cannot create primary backup folder: ${schedule.primaryBackupRoot}`);
      }
    }

    // Check database reachability
    try {
      await db.$queryRaw`SELECT 1`;
    } catch {
      issues.push('Database is not reachable');
    }

    // Check uploads folder
    const uploadsRoot = process.env.LOCAL_STORAGE_ROOT || '';
    if (uploadsRoot && !existsSync(uploadsRoot)) {
      warnings.push('Uploads folder does not exist — backups will have no files');
    }

    // Check disk space
    const freeBytes = await getFreeDiskBytes();
    const freeGb = freeBytes / (1024 * 1024 * 1024);
    if (freeGb < schedule.minimumFreeDiskGb) {
      warnings.push(
        `Low disk space: ${freeGb.toFixed(1)} GB free (minimum: ${schedule.minimumFreeDiskGb} GB)`
      );
    }

    // Check secondary location if configured
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
      throw new Error('Unauthorized');
    }

    const schedule = await backupRepository.getSchedule();
    if (!schedule) {
      throw new Error('No backup schedule configured');
    }

    // Check if backup is already running
    const running = await backupRepository.findRunningBackup();
    if (running) {
      throw new Error('A backup is already in progress');
    }

    // Check maintenance mode and backup lock
    const maintenanceSetting = await db.setting.findUnique({ where: { key: 'maintenanceMode' } });
    if (maintenanceSetting?.value === 'true') {
      throw new Error('Cannot run backup while maintenance mode is active');
    }

    const lock = await backupService.getLockStatus();
    if (lock.status !== 'NONE') {
      throw new Error(`Cannot run backup while lock is active (${lock.status} held by ${lock.owner})`);
    }

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'backup.scheduled_started',
      entity: 'BackupSchedule',
      entityId: schedule.id,
    });

    try {
      const result = await backupService.runScheduledBackup({
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

      // Calculate next run
      const nextRunAt = calculateNextRun({
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
    } catch (err: any) {
      await backupRepository.markScheduleFailure(schedule.id, err.message);

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'backup.scheduled_failed',
        entity: 'BackupSchedule',
        entityId: schedule.id,
        details: { error: err.message },
      });

      throw err;
    }
  },

  async getRestoreHistory(adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new Error('Unauthorized');
    }

    return backupRepository.listRestoreJobs();
  },

  async getStorage(adminRole: AdminRole) {
    if (!backupPolicy.canViewBackups(adminRole)) {
      throw new Error('Unauthorized');
    }

    const overview = await backupService.getStorageOverview();

    // Get largest file categories from upload records
    let largestFileCategories: { category: string; sizeBytes: number }[] = [];
    try {
      const categories: { purpose: string; _sum: { sizeBytes: number | null } }[] =
        await db.fileRecord.groupBy({
          by: ['purpose'],
          _sum: { sizeBytes: true },
          orderBy: { _sum: { sizeBytes: 'desc' as const } },
          take: 10,
        }) as any;
      largestFileCategories = categories
        .filter(c => c._sum.sizeBytes !== null)
        .map(c => ({ category: c.purpose, sizeBytes: Number(c._sum.sizeBytes) }));
    } catch {}

    // Get database size from PostgreSQL
    let databaseSizeBytes = 0;
    try {
      const result = await db.$queryRaw<{ size: bigint }[]>`
        SELECT pg_database_size(current_database()) as size
      `;
      if (result.length > 0) {
        databaseSizeBytes = Number(result[0].size);
      }
    } catch {}

    return {
      ...overview,
      databaseSizeBytes,
      largestFileCategories,
    };
  },
};

