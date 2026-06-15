import { NextRequest, NextResponse } from 'next/server';
import { join, resolve } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { getAdminSession, getSession } from '@/lib/get-session';
import { logger } from '@/lib/logger';
import { fileUseCases } from '@/server/modules/files/files.use-cases';
import { fileRepository } from '@/server/modules/files/files.repository';

const MIME_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await getSession();
    const adminSession = await getAdminSession();

    if (!session && !adminSession) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { path } = await params;
    const { db } = await import('@/lib/db');
    const setting = await db.systemSetting.findUnique({ where: { key: 'LOCAL_STORAGE_ROOT' } });
    const baseDir = setting?.value || process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
    const relativePath = path.join('/');
    const fullPath = resolve(baseDir, relativePath);

    if (!fullPath.startsWith(resolve(baseDir))) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    const normalizedPath = relativePath.replace(/\\/g, '/');
    if (
      normalizedPath.includes('..') ||
      normalizedPath.includes('~') ||
      normalizedPath.includes('//')
    ) {
      return new NextResponse('Bad Request', { status: 400 });
    }

    try {
      const content = await readFile(fullPath);

      const ext = relativePath.split('.').pop()?.toLowerCase();
      const contentType = MIME_TYPES[ext || ''] || 'application/octet-stream';

      return new NextResponse(content, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'private, max-age=3600',
        },
      });
    } catch {
      return new NextResponse('Not Found', { status: 404 });
    }
  } catch (err) {
    logger.error('[FilesProxy] Error:', err);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    if (path[0] === 'local-upload' && path[1]) {
      const fileRecordId = path[1];

      // Validate upload token
      const token = request.nextUrl.searchParams.get('token');
      if (!token) {
        return NextResponse.json({ error: 'Missing upload token' }, { status: 401 });
      }

      if (!fileUseCases._verifyUploadToken(fileRecordId, token)) {
        return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 403 });
      }

      // Look up the FileRecord
      const record = await fileRepository.getFileRecordById(fileRecordId);
      if (!record) {
        return NextResponse.json({ error: 'File record not found' }, { status: 404 });
      }

      if (record.status !== 'PENDING_UPLOAD') {
        return NextResponse.json(
          { error: `File is already ${record.status.toLowerCase()}. Cannot re-upload.` },
          { status: 409 }
        );
      }

      // Read the file body
      const buffer = Buffer.from(await request.arrayBuffer());
      const actualSize = buffer.length;

      // Re-validate file size against declared limit
      if (actualSize > record.sizeBytes) {
        return NextResponse.json(
          { error: 'Uploaded file exceeds declared size' },
          { status: 413 }
        );
      }

      // Write to local disk using the storage key path
      const { db: storageDb } = await import('@/lib/db');
      const storageSetting = await storageDb.systemSetting.findUnique({ where: { key: 'LOCAL_STORAGE_ROOT' } });
      const baseDir = storageSetting?.value || process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
      const fullPath = join(baseDir, record.storageKey);
      const dir = join(baseDir, record.storageKey.split('/').slice(0, -1).join('/'));

      await mkdir(dir, { recursive: true });
      await writeFile(fullPath, buffer);

      // Mark the FileRecord as UPLOADED
      await fileRepository.markUploaded(fileRecordId, actualSize);

      logger.info('[LocalUploadCatchAll] File uploaded successfully', {
        fileRecordId,
        storageKey: record.storageKey,
        sizeBytes: actualSize,
      });

      return NextResponse.json({
        status: 'uploaded',
        fileRecordId,
        sizeBytes: actualSize,
      });
    }

    return new NextResponse('Bad Request', { status: 400 });
  } catch (err) {
    logger.error('[LocalUploadCatchAll] Upload failed', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
