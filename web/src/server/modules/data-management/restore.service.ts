/**
 * Data Management — Restore Service
 *
 * Two-step restore: validate first, then execute.
 * Always creates a pre-restore backup before restoring.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createAuditLog } from '@/lib/audit-log';
import { backupRepository } from './backup.repository';
import { backupService } from './backup.service';
import { existsSync, mkdirSync, renameSync, rmSync } from 'fs';
import { join } from 'path';
import { restoreDatabase, extractArchive, runMigrations } from '@/lib/shell';

export const restoreService = {
  async validate(backupJobId: string, adminId: string) {
    const job = await backupRepository.getBackupJob(backupJobId);
    if (!job) {
      throw new Error('Backup job not found');
    }
    if (job.status !== 'COMPLETED') {
      throw new Error('Cannot restore from a non-completed backup');
    }

    const verification = await backupService.verifyBackup(backupJobId);

    await createAuditLog({
      actorId: adminId,
      actorType: 'ADMIN',
      action: 'restore.validated',
      entity: 'RestoreJob',
      entityId: backupJobId,
      details: { valid: verification.valid, errors: verification.errors },
    });

    return {
      backupId: job.id,
      backupType: job.type,
      createdAt: job.createdAt.toISOString(),
      valid: verification.valid,
      errors: verification.errors,
      warnings: verification.warnings,
    };
  },

  async startRestore(backupJobId: string, adminId: string) {
    const job = await backupRepository.getBackupJob(backupJobId);
    if (!job) throw new Error('Backup job not found');

    // Create restore job record
    const restoreJob = await backupRepository.createRestoreJob({
      backupJobId,
      status: 'RUNNING',
      requestedByAdminId: adminId,
    });

    // Acquire backup lock — prevents scheduled backups from running during restore
    await backupService.setBackupLock(true);

    try {
      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'restore.started',
        entity: 'RestoreJob',
        entityId: restoreJob.id,
        details: { backupId: backupJobId },
      });

      // 1. Create pre-restore backup
      logger.info('[RestoreService] Creating pre-restore backup');
      await backupService.createBackup({
        type: 'PRE_RESTORE',
        adminId,
        notes: `Pre-restore backup before restoring from ${backupJobId}`,
      });

      // 2. Validate backup again just before restore
      const verification = await backupService.verifyBackup(backupJobId);
      if (!verification.valid) {
        throw new Error(`Backup verification failed: ${verification.errors?.join(', ')}`);
      }

      // 3. Set maintenance mode
      try {
        await db.setting.upsert({
          where: { key: 'maintenanceMode' },
          update: { value: 'true' },
          create: { key: 'maintenanceMode', value: 'true' },
        });
      } catch {
        logger.warn('[RestoreService] Could not set maintenance mode');
      }

      // 4. Restore database via psql with arg array (no shell redirect)
      if (job.databasePath && existsSync(job.databasePath)) {
        logger.info('[RestoreService] Restoring database');
        const dbUrl = process.env.DATABASE_URL || '';
        try {
          restoreDatabase(dbUrl, job.databasePath);
        } catch (dbErr: any) {
          throw new Error(`Database restore failed: ${dbErr.message}`);
        }
      }

      // 5. Restore uploaded files
      if (job.filesPath && existsSync(job.filesPath)) {
        logger.info('[RestoreService] Restoring uploaded files');
        const uploadsRoot = process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');

        // Move current uploads to temp
        const tempDir = join(process.env.BACKUP_ROOT || '', 'restore-temp', Date.now().toString());
        if (existsSync(uploadsRoot)) {
          mkdirSync(tempDir, { recursive: true });
          try {
            // Use renameSync for cross-platform directory move
            const tempUploads = join(tempDir, 'uploads');
            renameSync(uploadsRoot, tempUploads);
          } catch {
            logger.warn('[RestoreService] Could not move current uploads to temp');
          }
        }

        // Extract backup uploads (cross-platform)
        mkdirSync(uploadsRoot, { recursive: true });
        try {
          extractArchive(job.filesPath, uploadsRoot);
        } catch (fileErr: any) {
          throw new Error(`Uploads restore failed: ${fileErr.message}`);
        }
      }

      // 6. Run prisma migrate deploy if needed
      logger.info('[RestoreService] Running database migrations');
      try {
        runMigrations(process.cwd());
      } catch (migrateErr: any) {
        logger.warn('[RestoreService] Migration after restore had issues', {
          error: migrateErr.message,
        });
      }

      // 7. Disable maintenance mode and release backup lock
      await backupService.setBackupLock(false);
      try {
        await db.setting.update({
          where: { key: 'maintenanceMode' },
          data: { value: 'false' },
        });
      } catch {
        logger.warn('[RestoreService] Could not disable maintenance mode');
      }

      // 8. Mark restore as completed
      await backupRepository.updateRestoreJob(restoreJob.id, {
        status: 'COMPLETED',
        approvedByAdminId: adminId,
        completedAt: new Date(),
      });

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'restore.completed',
        entity: 'RestoreJob',
        entityId: restoreJob.id,
        details: { backupId: backupJobId },
      });

      logger.info('[RestoreService] Restore completed successfully', { backupId: backupJobId });

      return { id: restoreJob.id, status: 'COMPLETED' };
    } catch (err: any) {
      // Mark restore as failed
      await backupRepository.updateRestoreJob(restoreJob.id, {
        status: 'FAILED',
        errorMessage: err.message,
        completedAt: new Date(),
      });

      // Release backup lock and disable maintenance mode on failure
      await backupService.setBackupLock(false).catch(() => {});
      try {
        await db.setting.update({
          where: { key: 'maintenanceMode' },
          data: { value: 'false' },
        });
      } catch {}

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'restore.failed',
        entity: 'RestoreJob',
        entityId: restoreJob.id,
        details: { backupId: backupJobId, error: err.message },
      });

      logger.error('[RestoreService] Restore failed', { backupId: backupJobId, error: err.message });
      throw err;
    }
  },
};
