import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { fileService } from '@/server/modules/files/files.service';
import { fileRepository } from '@/server/modules/files/files.repository';
import { fileUseCases } from '@/server/modules/files/files.use-cases';

export async function PUT(request: NextRequest) {
  // Gate: block in staging/production unless local_laptop mode is active
  if ((env.APP_ENV === 'staging' || env.APP_ENV === 'production') && env.DATA_MODE !== 'local_laptop') {
    return NextResponse.json({ error: 'Direct upload disabled in ' + env.APP_ENV }, { status: 403 });
  }

  try {
    const storageKey = request.nextUrl.searchParams.get('key');
    if (!storageKey) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    // Look up the FileRecord for this storageKey (may be null in dev mode without a pre-created record)
    const record = await fileRepository.getFileRecordByKey(storageKey);

    // In local_laptop mode, require HMAC token validation (same as local-upload endpoint)
    if (env.DATA_MODE === 'local_laptop') {
      if (!record) {
        return NextResponse.json({ error: 'No pending file record for this key' }, { status: 404 });
      }
      if (record.status !== 'PENDING_UPLOAD') {
        return NextResponse.json({ error: 'File record is not pending upload' }, { status: 409 });
      }
      const token = request.nextUrl.searchParams.get('token');
      if (!token) {
        return NextResponse.json({ error: 'Missing upload token' }, { status: 401 });
      }
      if (!fileUseCases._verifyUploadToken(record.id, token)) {
        return NextResponse.json({ error: 'Invalid or expired upload token' }, { status: 403 });
      }
    }

    const buffer = Buffer.from(await request.arrayBuffer());

    // Validate file size against declared limit
    if (record && buffer.length > record.sizeBytes) {
      return NextResponse.json({ error: 'Uploaded file exceeds declared size' }, { status: 413 });
    }

    const baseDir = env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
    const fullPath = join(baseDir, storageKey);
    const dir = join(baseDir, storageKey.split('/').slice(0, -1).join('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, buffer);

    const fileRecord = await fileService.getFileRecordById(storageKey);
    const recordId = fileRecord?.id || storageKey;

    return NextResponse.json({ status: 'ok', fileRecordId: recordId });
  } catch (err) {
    logger.error('[DirectUpload] Failed', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
