import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { requireAdmin } from '@/lib/rbac';
import { requireCronAuth } from '@/lib/cron-auth';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// P0: migration/table counts are operational internals — admin or cron only.
export async function GET(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    const cronRejection = requireCronAuth(request);
    if (cronRejection) return cronRejection;
  }

  const start = Date.now();

  try {
    // Basic connectivity
    await db.$queryRaw`SELECT 1`;

    // Check migration status via Prisma
    let pendingMigrations = 0;
    try {
      const result = (await db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM _prisma_migrations WHERE finished_at IS NULL`
      )) as any;
      pendingMigrations = Number(result[0]?.count ?? 0);
    } catch {
      // _prisma_migrations table may not exist yet
    }

    // Check table count as a basic schema health indicator
    let tableCount = 0;
    try {
      const result = (await db.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = 'public'`
      )) as any;
      tableCount = Number(result[0]?.count ?? 0);
    } catch {
      // Fallback if information_schema is unavailable
    }

    const latencyMs = Date.now() - start;

    return NextResponse.json({
      status: 'healthy',
      latencyMs,
      pendingMigrations,
      tableCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = errorMessage(err);
    logger.error('[Health/DB] Database check failed', { error: message });

    // P1: generic — raw pg text aids fingerprinting (logged above).
    return NextResponse.json(
      {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: 'Database unavailable',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
