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

/** @deprecated Legacy Setting table has been consolidated into SystemSetting. */

async function getSystemSettingValue(key: string, fallback: string): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key } });
    return setting?.value || fallback;
  } catch {
    return fallback;
  }
}

export async function setMaintenanceMode(enabled: boolean, message?: string): Promise<void> {
  await Promise.all([
    db.systemSetting.upsert({
      where: { key: 'MAINTENANCE_MODE' },
      update: { value: String(enabled) },
      create: {
        key: 'MAINTENANCE_MODE',
        value: String(enabled),
        valueType: 'BOOLEAN',
        category: 'SERVER',
        description: 'Whether rider-facing operations are paused for maintenance/restore.',
      },
    }),
    db.systemSetting.upsert({
      where: { key: 'MAINTENANCE_MESSAGE' },
      update: { value: message || 'System maintenance in progress. Please check back later.' },
      create: {
        key: 'MAINTENANCE_MESSAGE',
        value: message || 'System maintenance in progress. Please check back later.',
        valueType: 'STRING',
        category: 'SERVER',
        description: 'Message shown while maintenance mode is active.',
      },
    }),
    // Legacy Setting consolidation: maintenanceMode is now stored in SystemSetting
    // as MAINTENANCE_MODE. The old db.setting.upsert is removed.
  ]);
}

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

    // PR-7 (2026-08-06 fix-plan, 6th audit P0): track the pre-restore backup so
    // a mid-restore failure cannot silently orphan it. On failure the catch
    // block marks it ORPHANED_BY_FAILED_RESTORE:<restoreJobId> and emits an
    // audit entry; the orphan-backup-cleanup worker purges it after 7 days.
    let preRestoreBackupId: string | null = null;

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
      const preRestoreBackup = await backupService.createBackup({
        type: 'PRE_RESTORE',
        adminId,
        notes: `Pre-restore backup before restoring from ${backupJobId}`,
      });
      // Defensive: createBackup may resolve without a row id in some paths —
      // an untracked backup is only a missed orphan flag, never a crash.
      preRestoreBackupId = preRestoreBackup?.id ?? null;

      // 2. Validate backup again just before restore
      const verification = await backupService.verifyBackup(backupJobId);
      if (!verification.valid) {
        throw new Error(`Backup verification failed: ${verification.errors?.join(', ')}`);
      }

      // 3. Set maintenance mode in SystemSetting + legacy Setting compatibility table
      try {
        await setMaintenanceMode(true, 'Restore in progress. Please check back later.');
      } catch {
        logger.warn('[RestoreService] Could not set maintenance mode');
      }

      // 4. Restore database via psql with arg array (no shell redirect)
      if (job.databasePath && existsSync(job.databasePath)) {
        logger.info('[RestoreService] Restoring database');
        const dbUrl = process.env.DATABASE_URL || '';
        try {
          restoreDatabase(dbUrl, job.databasePath);
        } catch (dbErr: unknown) {
          throw new Error(`Database restore failed: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}`);
        }
      }

      // 5. Restore uploaded files
      if (job.filesPath && existsSync(job.filesPath)) {
        logger.info('[RestoreService] Restoring uploaded files');
        // Read uploads root from Admin-managed SystemSetting first, then env fallback.
        const uploadsRoot = await getSystemSettingValue(
          'LOCAL_STORAGE_ROOT',
          process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads')
        );

        const backupRoot = await getSystemSettingValue(
          'BACKUP_ROOT',
          process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups')
        );
        const tempDir = join(backupRoot, 'restore-temp', Date.now().toString());

        let tempUploadsMoved = false;
        let tempUploads: string | null = null;
        if (existsSync(uploadsRoot)) {
          mkdirSync(tempDir, { recursive: true });
          tempUploads = join(tempDir, 'uploads');
          try {
            renameSync(uploadsRoot, tempUploads);
            tempUploadsMoved = true;
          } catch (renameErr: unknown) {
            throw new Error(`Cannot proceed with restore: current uploads directory is locked (${renameErr instanceof Error ? renameErr.message : String(renameErr)})`);
          }
        }

        // Extract backup uploads (cross-platform)
        mkdirSync(uploadsRoot, { recursive: true });
        try {
          extractArchive(job.filesPath, uploadsRoot);
        } catch (fileErr: unknown) {
          throw new Error(`Uploads restore failed: ${fileErr instanceof Error ? fileErr.message : String(fileErr)}`);
        }
      }

      // 6. Run prisma migrate deploy if needed
      logger.info('[RestoreService] Running database migrations');
      try {
        runMigrations(process.cwd());
      } catch (migrateErr: unknown) {
        throw new Error(`Database migration after restore failed: ${migrateErr instanceof Error ? migrateErr.message : String(migrateErr)}`);
      }

      // 6b. Smoke test query to confirm DB queryability post-restore
      try {
        await db.rider.count();
      } catch (smokeErr: unknown) {
        throw new Error(`Post-restore DB smoke query failed: ${smokeErr instanceof Error ? smokeErr.message : String(smokeErr)}`);
      }

      // 7. Disable maintenance mode and release backup lock
      await backupService.setBackupLock(false);
      try {
        await setMaintenanceMode(false);
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
    } catch (err: unknown) {
      // Mark restore as failed
      await backupRepository.updateRestoreJob(restoreJob.id, {
        status: 'FAILED',
        errorMessage: (err instanceof Error ? err.message : String(err)),
        completedAt: new Date(),
      });

      // PR-7: a pre-restore backup that survived past this point is orphaned —
      // the failure happened after it was taken, so it is the only recent
      // snapshot of the pre-restore state. Flag it for the cleanup worker
      // (which purges ORPHANED_BY_FAILED_RESTORE backups after 7 days) and
      // surface it in the audit trail so the operator knows the safety
      // snapshot exists.
      if (preRestoreBackupId) {
        try {
          await backupRepository.updateBackupJob(preRestoreBackupId, {
            errorMessage: `ORPHANED_BY_FAILED_RESTORE:${restoreJob.id}`,
          });
        } catch (flagErr) {
          logger.error('[RestoreService] Failed to mark pre-restore backup as orphaned', {
            backupId: preRestoreBackupId,
            error: flagErr instanceof Error ? flagErr.message : String(flagErr),
          });
        }
        await createAuditLog({
          actorId: adminId,
          actorType: 'ADMIN',
          action: 'restore.orphaned_pre_restore_backup',
          entity: 'BackupJob',
          entityId: preRestoreBackupId,
          details: { restoreJobId: restoreJob.id, error: (err instanceof Error ? err.message : String(err)) },
        });
      }

      // Release backup lock and disable maintenance mode on failure
      await backupService.setBackupLock(false).catch(() => {});
      try {
        await setMaintenanceMode(false);
      } catch {}

      await createAuditLog({
        actorId: adminId,
        actorType: 'ADMIN',
        action: 'restore.failed',
        entity: 'RestoreJob',
        entityId: restoreJob.id,
        details: { backupId: backupJobId, error: (err instanceof Error ? err.message : String(err)) },
      });

      logger.error('[RestoreService] Restore failed', {
        backupId: backupJobId,
        error: (err instanceof Error ? err.message : String(err)),
      });
      throw err;
    }
  },
};
