import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { access, mkdir } from 'fs/promises';
import { constants, existsSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';

async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key } });
    return setting?.value || fallback;
  } catch {
    return fallback;
  }
}

async function checkPath(path: string) {
  const existedBefore = existsSync(path);
  if (!existedBefore) {
    await mkdir(path, { recursive: true });
  }
  await access(path, constants.R_OK | constants.W_OK);
  return { path, exists: true, writable: true, created: !existedBefore };
}

export async function GET() {
  const start = Date.now();

  try {
    const uploadsRoot = await getSetting('LOCAL_STORAGE_ROOT', process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads'));
    const backupRoot = await getSetting('BACKUP_ROOT', process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups'));
    const secondaryRoot = await getSetting('BACKUP_SECONDARY_ROOT', process.env.BACKUP_SECONDARY_ROOT || '');

    const uploads = await checkPath(uploadsRoot);
    const backups = await checkPath(backupRoot);
    let secondary: any = null;

    if (secondaryRoot.trim()) {
      try {
        secondary = await checkPath(secondaryRoot);
      } catch (err: any) {
        secondary = { path: secondaryRoot, exists: existsSync(secondaryRoot), writable: false, error: err?.message ?? 'Secondary backup path not writable' };
      }
    }

    const healthy = uploads.writable && backups.writable && (!secondary || secondary.writable);

    return NextResponse.json({
      status: healthy ? 'healthy' : 'degraded',
      provider: 'local',
      storageRoot: uploadsRoot,
      backupRoot,
      secondaryBackupRoot: secondaryRoot || null,
      checks: { uploads, backups, secondary },
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    }, { status: healthy ? 200 : 200 });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'unhealthy',
        provider: 'local',
        latencyMs: Date.now() - start,
        error: err?.message ?? 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
