import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { access } from 'fs/promises';
import { constants, existsSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requireAdmin } from '@/lib/rbac';
import { requireCronAuth } from '@/lib/cron-auth';

async function getSetting(key: string, fallback: string): Promise<string> {
  try {
    const setting = await db.systemSetting.findUnique({ where: { key } });
    return setting?.value || fallback;
  } catch {
    return fallback;
  }
}

// P1-2: read-only storage check. The previous version called
// `mkdir(path, { recursive: true })` whenever a configured path was
// missing — a health check that mutates the filesystem. Misconfigs
// self-healed into real directory trees instead of alerting. The
// fix is to report non-existent without creating. The backup/restore
// job (which legitimately needs the dirs) owns creation.
async function checkPath(path: string) {
  if (!existsSync(path)) {
    return { path, exists: false, writable: false };
  }
  try {
    await access(path, constants.R_OK | constants.W_OK);
    return { path, exists: true, writable: true };
  } catch {
    return { path, exists: true, writable: false };
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function GET(request: NextRequest) {
  // P0: absolute server paths + writability are operational internals —
  // admin or cron only (was public).
  const admin = await requireAdmin();
  if (!admin) {
    const cronRejection = requireCronAuth(request);
    if (cronRejection) return cronRejection;
  }

  const start = Date.now();

  try {
    const uploadsRoot = await getSetting(
      'LOCAL_STORAGE_ROOT',
      process.env.LOCAL_STORAGE_ROOT || join(process.cwd(), 'data', 'uploads')
    );
    const backupRoot = await getSetting(
      'BACKUP_ROOT',
      process.env.BACKUP_ROOT || join(process.cwd(), 'data', 'backups')
    );
    const secondaryRoot = await getSetting(
      'BACKUP_SECONDARY_ROOT',
      process.env.BACKUP_SECONDARY_ROOT || ''
    );

    const uploads = await checkPath(uploadsRoot);
    const backups = await checkPath(backupRoot);
    let secondary: any = null;

    if (secondaryRoot.trim()) {
      try {
        secondary = await checkPath(secondaryRoot);
      } catch (err: unknown) {
        secondary = {
          path: secondaryRoot,
          exists: existsSync(secondaryRoot),
          writable: false,
          error: errorMessage(err) || 'Secondary backup path not writable',
        };
      }
    }

    const healthy = uploads.writable && backups.writable && (!secondary || secondary.writable);

    // P1-4 (system-settings audit, 2026-09-08): the runtime and the
    // health check used to disagree on which source each reported
    // path came from (DB / env / default). Monitoring and runtime
    // would each confidently report a different value. Tag every
    // path with its source so monitoring can flag drift explicitly
    // instead of relying on the path string alone. We re-query the
    // row's existence and the env var so the source label reflects
    // reality, not the DB-first fallback.
    async function sourceFor(
      key: string,
      envVarName: string,
      _reportedValue: string
    ): Promise<'DB' | 'env' | 'default'> {
      try {
        const row = await db.systemSetting.findUnique({ where: { key } });
        if (row?.value) return 'DB';
      } catch {
        // DB unavailable — fall through to env/default detection
      }
      if (process.env[envVarName]) return 'env';
      // If we got here, the reported value is the default. The exact
      // default path string isn't important for monitoring — what
      // matters is "this is not from your config".
      return 'default';
    }
    const uploadsSource = await sourceFor('LOCAL_STORAGE_ROOT', 'LOCAL_STORAGE_ROOT', uploadsRoot);
    const backupSource = await sourceFor('BACKUP_ROOT', 'BACKUP_ROOT', backupRoot);
    const secondarySource = secondaryRoot
      ? await sourceFor('BACKUP_SECONDARY_ROOT', 'BACKUP_SECONDARY_ROOT', secondaryRoot)
      : null;

    return NextResponse.json(
      {
        status: healthy ? 'healthy' : 'degraded',
        provider: 'local',
        storageRoot: uploadsRoot,
        backupRoot,
        secondaryBackupRoot: secondaryRoot || null,
        // P1-4: tag each path with its source (DB / env / default)
        // so monitoring can flag drift explicitly.
        sources: {
          uploadsRoot: uploadsSource,
          backupRoot: backupSource,
          secondaryBackupRoot: secondarySource,
        },
        checks: { uploads, backups, secondary },
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      },
      { status: healthy ? 200 : 200 }
    );
  } catch (err: unknown) {
    const message = errorMessage(err);
    logger.error('[Health/Storage] Storage check failed', { error: message });
    // P0: generic — raw fs/DB text aids fingerprinting (logged above).
    return NextResponse.json(
      {
        status: 'unhealthy',
        provider: 'local',
        latencyMs: Date.now() - start,
        error: 'Storage health check unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
