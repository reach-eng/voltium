import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { invalidateCache, getCacheStats, getCacheVersion } from '@/lib/cache';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return errors.unauthorized();

  try {
    const body = await req.json();
    const { pattern } = body;

    if (pattern && typeof pattern !== 'string') {
      return errors.badRequest('Pattern must be a string');
    }

    invalidateCache(pattern);
    logger.info('[Admin] Cache invalidated', { pattern: pattern || 'all' });

    return success(
      { invalidated: pattern || 'all', stats: getCacheStats(), version: getCacheVersion() },
      'Cache invalidated successfully'
    );
  } catch (error) {
    logger.error('Cache invalidation error:', error);
    return errors.internal('Failed to invalidate cache');
  }
}

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return errors.unauthorized();

  return success({
    stats: getCacheStats(),
    version: getCacheVersion(),
  });
}
