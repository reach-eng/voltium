import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
// P1-4 (system-settings audit, 2026-09-08): the readiness probe used
// to resolve `uploadsRoot` from env only (`process.env.LOCAL_STORAGE_ROOT
// || join(cwd, ...)`) — runtime reads DB-first. After a DB root change,
// this probe kept reporting the env path as gospel. Use the same
// resolution order as runtime (DB → env → default) so the readiness
// signal and the runtime agree on the active path.
import { StoragePathBuilder } from '@/lib/storage-path-builder';
import { existsSync, accessSync, constants } from 'fs';

export const dynamic = 'force-dynamic';

function checkWritable(path: string): boolean {
  try {
    const exists = existsSync(path);
    if (!exists) return false;
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function GET() {
  try {
    // 1. Check Database connection
    await db.$queryRaw`SELECT 1`;

    // 2. Check essential volumes — DB-first resolution via the
    // same builder the rest of the app uses. Falls back to env
    // and to the default if the DB row is missing.
    const uploadsRoot = await StoragePathBuilder.getUploadsRoot();
    if (!checkWritable(uploadsRoot)) {
      logger.error('Readiness probe failed: Upload volume not writable', { uploadsRoot });
      return NextResponse.json(
        { status: 'unready', reason: 'storage', uploadsRoot },
        { status: 503 }
      );
    }

    // Since we're using in-memory caches and background workers, DB and storage are the primary dependencies.

    return NextResponse.json({ status: 'ready' }, { status: 200 });
  } catch (error) {
    logger.error('Readiness probe failed', { error });
    return NextResponse.json({ status: 'unready', reason: 'database' }, { status: 503 });
  }
}
