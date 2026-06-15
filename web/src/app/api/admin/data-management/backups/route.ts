import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import { createBackupSchema, backupQuerySchema } from '@/server/modules/data-management/backup.schemas';
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

export async function GET(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const params = backupQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
    const result = await dataManagementUseCases.listBackups({
      ...params,
      adminRole: session.role as AdminRole,
    });

    const totalPages = Math.ceil(result.total / result.limit);
    const data = {
      jobs: result.items.map(serializeBackupJob),
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        totalPages,
      },
    };

    return NextResponse.json({ success: true, data });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = createBackupSchema.parse(await request.json());
    const result = await dataManagementUseCases.createBackup({
      type: body.type,
      adminId: session.adminId ?? undefined,
      adminRole: session.role as AdminRole,
    });

    return NextResponse.json({
      success: true,
      data: serializeBackupJob(result),
      expiresIn: 900,
    }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error: err.message,
    }, { status: err.message === 'Unauthorized' ? 403 : 500 });
  }
}
