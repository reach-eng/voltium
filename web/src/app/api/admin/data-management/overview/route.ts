import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';

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

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const overview = await dataManagementUseCases.getOverview(session.role as AdminRole);
    
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

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
