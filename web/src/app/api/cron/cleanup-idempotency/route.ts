/**
 * T-97 (PR-7, 2026-08-23): hourly cron to purge expired
 * `idempotency_keys` rows.
 *
 * The `purgeExpiredIdempotencyKeys` helper at lib/idempotency.ts:233
 * has existed for months but had ZERO callers — the table grew
 * unbounded (1 row per request, 24h TTL by default). Wire it to
 * a cron route so the table stays bounded.
 *
 * Schedule: `0 * * * *` (top of every hour). The route is
 * fail-closed (requireCronAuth), matches the other cron routes.
 *
 * See docs/AUDIT_WORKFLOWS_2026-08-23.md §2.9.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { purgeExpiredIdempotencyKeys } from '@/lib/idempotency';
import { requireCronAuth } from '@/lib/cron-auth';
import { logger } from '@/lib/logger';

export async function GET(req: NextRequest) {
  const authError = requireCronAuth(req);
  if (authError) return authError;

  try {
    const purged = await purgeExpiredIdempotencyKeys();
    return success({ purged }, `Purged ${purged} expired idempotency keys`);
  } catch (error) {
    logger.error('[Cron:CleanupIdempotency] Purge failed:', error);
    return errors.internal('Failed to purge expired idempotency keys');
  }
}
