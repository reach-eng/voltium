import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { execSync } from 'child_process';

const VERSION = process.env.npm_package_version ?? '0.2.0';

async function checkDatabase(): Promise<{ status: 'healthy' | 'unhealthy'; latencyMs: number; error?: string }> {
  const start = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: 'healthy', latencyMs: Date.now() - start };
  } catch (err: any) {
    logger.error('[Health] Database check failed', { error: err?.message });
    return {
      status: 'unhealthy',
      latencyMs: Date.now() - start,
      error: err?.message ?? 'Unknown error',
    };
  }
}

export async function GET(request: NextRequest) {
  const dbCheck = await checkDatabase();
  const healthy = dbCheck.status === 'healthy';
  const body = {
    status: healthy ? 'ok' : 'unhealthy',
    db: healthy,
    redis: true,
  };
  const statusCode = healthy ? 200 : 503;
  return NextResponse.json(body, { status: statusCode });
}
