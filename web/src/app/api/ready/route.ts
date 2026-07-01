import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { execFileSync } from 'child_process';
import { existsSync, accessSync, constants } from 'fs';
import { join } from 'path';

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
    
    // 2. Check essential volumes
    const uploadsRoot = process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads');
    if (!checkWritable(uploadsRoot)) {
      logger.error('Readiness probe failed: Upload volume not writable');
      return NextResponse.json({ status: 'unready', reason: 'storage' }, { status: 503 });
    }

    // Since we're using in-memory caches and background workers, DB and storage are the primary dependencies.
    
    return NextResponse.json({ status: 'ready' }, { status: 200 });
  } catch (error) {
    logger.error('Readiness probe failed', { error });
    return NextResponse.json({ status: 'unready', reason: 'database' }, { status: 503 });
  }
}
