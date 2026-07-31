/**
 * Data Management — Backup Repository
 *
 * Database access for BackupJob and RestoreJob models.
 */

import { db } from '@/lib/db';
import type { BackupType, BackupStatus, RestoreStatus } from './backup.types';

export const backupRepository = {
  // ── Backup Schedule ────────────────────────────────────────────────────

  async getSchedule(): Promise<any | null> {
    return db.backupSchedule.findFirst({ orderBy: { createdAt: 'desc' } });
  },

  async upsertSchedule(data: any): Promise<any> {
    const existing = await db.backupSchedule.findFirst({ orderBy: { createdAt: 'desc' } });
    if (existing) {
      return db.backupSchedule.update({ where: { id: existing.id }, data });
    }
    return db.backupSchedule.create({ data });
  },

  async markScheduleSuccess(id: string, lastRunAt: Date, nextRunAt: Date) {
    return db.backupSchedule.update({
      where: { id },
      data: { lastRunAt, nextRunAt, lastStatus: 'COMPLETED', lastError: null },
    });
  },

  async markScheduleFailure(id: string, error: string) {
    return db.backupSchedule.update({
      where: { id },
      data: { lastStatus: 'FAILED', lastError: error },
    });
  },

  async findRunningBackup(): Promise<any | null> {
    return db.backupJob.findFirst({
      where: { status: { in: ['QUEUED', 'RUNNING'] } },
    });
  },

  async countBackupsByTypeAndAge(type: string, olderThan: Date): Promise<number> {
    return db.backupJob.count({
      where: { scheduleType: type, createdAt: { lt: olderThan }, status: 'COMPLETED' },
    });
  },

  // ── Backup Jobs ────────────────────────────────────────────────────────

  async createBackupJob(data: {
    type: string;
    scheduleType?: string;
    status: string;
    createdByAdminId?: string;
  }) {
    return db.backupJob.create({ data });
  },

  async updateBackupJob(
    id: string,
    data: {
      status?: string;
      backupPath?: string;
      databasePath?: string;
      filesPath?: string;
      manifestPath?: string;
      checksumPath?: string;
      sizeBytes?: bigint;
      fileCount?: number;
      errorMessage?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  ) {
    return db.backupJob.update({ where: { id }, data });
  },

  async getBackupJob(id: string) {
    return db.backupJob.findUnique({
      where: { id },
      include: { createdByAdmin: { select: { id: true, name: true, email: true } } },
    });
  },

  async listBackupJobs(params: { page: number; limit: number; type?: string; status?: string }) {
    const where: any = {};
    if (params.type) where.type = params.type;
    if (params.status) where.status = params.status;

    const [items, total] = await Promise.all([
      db.backupJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        include: { createdByAdmin: { select: { id: true, name: true } } },
      }),
      db.backupJob.count({ where }),
    ]);

    return { items, total, page: params.page, limit: params.limit };
  },

  async deleteBackupJob(id: string) {
    return db.backupJob.delete({ where: { id } });
  },

  async getBackupStats() {
    const [total, completed, failed, totalSize] = await Promise.all([
      db.backupJob.count(),
      db.backupJob.count({ where: { status: 'COMPLETED' } }),
      db.backupJob.count({ where: { status: 'FAILED' } }),
      db.backupJob.aggregate({ _sum: { sizeBytes: true } }),
    ]);

    return { total, completed, failed, totalSizeBytes: totalSize._sum.sizeBytes };
  },

  async getLatestBackup() {
    return db.backupJob.findFirst({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
    });
  },

  // Restore Jobs
  async createRestoreJob(data: {
    backupJobId: string;
    status: string;
    requestedByAdminId: string;
  }) {
    return db.restoreJob.create({ data });
  },

  async updateRestoreJob(
    id: string,
    data: {
      status?: string;
      approvedByAdminId?: string;
      errorMessage?: string;
      startedAt?: Date;
      completedAt?: Date;
    }
  ) {
    return db.restoreJob.update({ where: { id }, data });
  },

  async listRestoreJobs(limit = 20) {
    return db.restoreJob.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        backupJob: { select: { id: true, type: true, createdAt: true } },
      },
    });
  },
};
