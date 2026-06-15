import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import { existsSync, readFileSync, rmSync } from 'fs';
import { join } from 'path';
import { createArchive } from '@/lib/shell';
import { tmpdir } from 'os';
import type { AdminRole } from '@/server/modules/admin/admin.types';

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const job = await dataManagementUseCases.downloadBackup(params.id, session.role as AdminRole);
    if (!job) {
      return NextResponse.json({ error: 'Backup not found' }, { status: 404 });
    }

    // Check if backup files exist on disk
    if (!job.backupPath || !existsSync(job.backupPath)) {
      return NextResponse.json({ error: 'Backup files not found on disk' }, { status: 404 });
    }

    // Create a downloadable archive from the backup folder
    const tempFile = join(tmpdir(), `backup-download-${params.id.slice(0, 8)}.zip`);
    try {
      createArchive(job.backupPath, tempFile);

      const fileBuffer = readFileSync(tempFile);
      const fileName = `backup-${job.type?.toLowerCase() || 'unknown'}-${params.id.slice(0, 8)}.zip`;

      return new NextResponse(fileBuffer, {
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': String(fileBuffer.length),
        },
      });
    } finally {
      // Clean up temp file
      try { rmSync(tempFile, { force: true }); } catch {}
    }
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
