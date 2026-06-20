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

import { fileService } from '@/server/modules/files/files.service';

function validateMagicBytes(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
    return buffer.length >= 3 && buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  if (mimeType === 'image/png') {
    return (
      buffer.length >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4E &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0D &&
      buffer[5] === 0x0A &&
      buffer[6] === 0x1A &&
      buffer[7] === 0x0A
    );
  }
  if (mimeType === 'application/pdf') {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x25 && // '%'
      buffer[1] === 0x50 && // 'P'
      buffer[2] === 0x44 && // 'D'
      buffer[3] === 0x46    // 'F'
    );
  }
  if (mimeType === 'image/webp') {
    return (
      buffer.length >= 12 &&
      buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && // 'RIFF'
      buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50   // 'WEBP'
    );
  }
  if (mimeType === 'video/mp4') {
    return (
      buffer.length >= 8 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70 // 'ftyp'
    );
  }
  return true;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const session = await getSession(request);
    const adminSession = await getAdminSession(request);

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

    // Look up the FileRecord
    const record = await fileRepository.getFileRecordByKey(normalizedPath);
    if (!record) {
      return new NextResponse('Not Found', { status: 404 });
    }

    // Perform ownership/permission check
    let actor: { role: string; permissions?: string[]; riderDbId?: string } | null = null;
    if (adminSession) {
      actor = {
        role: 'admin',
        permissions: adminSession.adminPermissions || [],
        riderDbId: adminSession.riderDbId || adminSession.adminId,
      };
    } else if (session) {
      actor = {
        role: 'rider',
        riderDbId: session.riderDbId,
      };
    }

    if (!actor || !fileService.canViewFile(actor, record as any)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Log admin view if actor is admin
    if (actor.role === 'admin' && actor.riderDbId) {
      await fileService.logAdminFileView(actor.riderDbId, record.id, record.purpose, record.ownerId).catch(err => {
        logger.error('Failed to log admin file view', err);
      });
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

      // Validate magic bytes to prevent content-type sniffing/spoofing
      if (!validateMagicBytes(buffer, record.mimeType)) {
        return NextResponse.json(
          { error: 'File content does not match the allowed mime type' },
          { status: 400 }
        );
      }

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
      const resolvedBase = resolve(baseDir);
      const fullPath = resolve(join(baseDir, record.storageKey));

      // Path traversal protection on storageKey
      if (!fullPath.startsWith(resolvedBase + (fullPath === resolvedBase ? '' : '/'))) {
        logger.warn('[LocalUploadCatchAll] Path traversal attempt blocked', { storageKey: record.storageKey });
        return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
      }

      // Additional: reject storageKey containing traversal markers
      const normalizedKey = record.storageKey.replace(/\\/g, '/');
      if (normalizedKey.includes('..') || normalizedKey.includes('~') || normalizedKey.startsWith('/')) {
        return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
      }

      const dir = resolve(join(baseDir, record.storageKey.split('/').slice(0, -1).join('/')));
      if (!dir.startsWith(resolvedBase)) {
        return NextResponse.json({ error: 'Invalid storage path' }, { status: 403 });
      }

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
