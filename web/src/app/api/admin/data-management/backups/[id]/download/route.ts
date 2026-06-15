import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await dataManagementUseCases.downloadBackup(
      params.id,
      session.role as AdminRole
    );

    // Determine which file to serve: prefer the tar archive if it exists, otherwise the DB dump
    let filePath: string | null = null;
    let fileName = `backup-${params.id.slice(0, 8)}.tar.gz`;
    let contentType = 'application/gzip';

    if (job.filesPath && existsSync(job.filesPath)) {
      filePath = job.filesPath;
    } else if (job.databasePath && existsSync(job.databasePath)) {
      filePath = job.databasePath;
      fileName = `backup-${params.id.slice(0, 8)}-database.sql`;
      contentType = 'application/sql';
    } else if (job.backupPath && existsSync(job.backupPath)) {
      // Fallback: serve manifest file as JSON
      filePath = join(job.backupPath, 'manifest.json');
      fileName = `backup-${params.id.slice(0, 8)}-manifest.json`;
      contentType = 'application/json';
    }

    if (!filePath || !existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: 'Backup files not found on disk' },
        { status: 404 }
      );
    }

    const buffer = await readFile(filePath);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(buffer.length),
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    const status =
      err.message === 'Unauthorized'
        ? 403
        : err.message === 'Backup not found' || err.message === 'Backup files not found on disk'
          ? 404
          : 500;
    return NextResponse.json(
      { success: false, error: err.message },
      { status }
    );
  }
}
