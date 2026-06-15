import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await dataManagementUseCases.getBackupDetails(params.id, session.role as AdminRole);
    return NextResponse.json({ success: true, data: serializeBackupJob(result) });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dataManagementUseCases.deleteBackup(params.id, session.role as AdminRole, session.adminId ?? '');
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
