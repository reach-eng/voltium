import { NextRequest, NextResponse } from 'next/server';
import { join, resolve } from 'path';
import { readFile } from 'fs/promises';
import { getAdminSession, getSession } from '@/lib/get-session';
import { logger } from '@/lib/logger';

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

    const baseDir = join(process.cwd(), 'data', 'uploads');
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
