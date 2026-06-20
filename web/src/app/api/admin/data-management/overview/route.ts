import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { withApiHandler } from '@/lib/api-handler';
import { success, errors } from '@/lib/api-response';

function serializeBackupJob(job: any) {
  if (!job) return null;
  return {
    ...job,
    sizeBytes: job.sizeBytes == null ? null : Number(job.sizeBytes),
    createdAt: job.createdAt?.toISOString?.() ?? job.createdAt,
    startedAt: job.startedAt?.toISOString?.() ?? job.startedAt,
    completedAt: job.completedAt?.toISOString?.() ?? job.completedAt,
  };
}

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await getAdminSession(request);
  if (!session) {
    return errors.unauthorized('Unauthorized');
  }

  const overview = await dataManagementUseCases.getOverview(session.adminRole as AdminRole);
  
  // Count running jobs
  const runningBackups = await db.backupJob.count({
    where: { status: { in: ['QUEUED', 'RUNNING'] } }
  });

  const data = {
    stats: {
      totalBackups: overview.stats.total,
      totalSizeBytes: overview.stats.totalSizeBytes ? Number(overview.stats.totalSizeBytes) : 0,
      lastBackupAt: overview.latestBackup?.completedAt?.toISOString() ?? null,
      lastBackupStatus: overview.latestBackup?.status ?? null,
      failedBackups: overview.stats.failed,
      runningBackups,
    },
    latestBackup: serializeBackupJob(overview.latestBackup),
    storage: overview.storage,
    maintenanceMode: overview.maintenanceMode,
    scheduleStatus: overview.scheduleStatus,
  };

  return success(data);
});
