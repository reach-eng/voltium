import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { writeFile, mkdir } from 'fs/promises';
import { logger } from '@/lib/logger';
import { fileService } from '@/server/modules/files/files.service';

export async function PUT(request: NextRequest) {
  try {
    const storageKey = request.nextUrl.searchParams.get('key');
    if (!storageKey) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const buffer = Buffer.from(await request.arrayBuffer());

    const baseDir = join(process.cwd(), 'data', 'uploads');
    const fullPath = join(baseDir, storageKey);
    const dir = join(baseDir, storageKey.split('/').slice(0, -1).join('/'));
    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, buffer);

    const record = await fileService.getFileRecordById(storageKey);
    const recordId = record?.id || storageKey;

    return NextResponse.json({ status: 'ok', fileRecordId: recordId });
  } catch (err) {
    logger.error('[DirectUpload] Failed', err);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
