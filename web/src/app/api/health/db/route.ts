import { NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET() {
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
  } catch (err: any) {
    logger.error('[Health/DB] Database check failed', { error: err?.message });

    return NextResponse.json(
      {
        status: 'unhealthy',
        latencyMs: Date.now() - start,
        error: err?.message ?? 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
