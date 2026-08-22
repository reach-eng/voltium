import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { getAllFeatureFlags, updateFeatureFlag } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';
import { invalidateCache } from '@/lib/cache';
import { updateFeatureFlagSchema } from '@/lib/validators/admin';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'settings_manage')) return adminForbidden();

  try {
    // Feature flags are static for long stretches — but P3-11 (2026-08-05 ops
    // audit) pointed out that a per-admin browser cache meant OTHER admins saw
    // stale flags for up to 60s after a PUT. Flags are global data; 5s is
    // fresh enough and cheap (one findMany, in-memory-cached server-side).
    const flags = await getAllFeatureFlags();
    return withCacheHeaders(success(flags, 'Feature flags retrieved'), 5);
  } catch (error) {
    logger.error('[FEATURE_FLAGS_GET]', error);
    return errors.internal('Failed to fetch feature flags');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'settings_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = updateFeatureFlagSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { key, value } = validation.data;

    // P1-15: the schema's z.union([string, number, boolean]) already rejects
    // objects — String(value) below only ever sees a primitive.
    const updated = await updateFeatureFlag(key, String(value));
    if (!updated) {
      return errors.internal('Failed to update feature flag');
    }

    // P1-16: scoped invalidation — the wildcard 'admin:feature-flags:*' nuked
    // every admin's cache entry on one flag flip. Flags are global, so a
    // single canonical key is the right granularity (the in-memory flag cache
    // in feature-flags.ts is already cleared by updateFeatureFlag itself).
    invalidateCache('admin:feature-flags:list');

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    createAuditLog({
      actorId,
      action: 'feature_flag.update',
      entity: 'feature_flags',
      entityId: key,
      // P2-13: don't write the value into the audit trail — a future
      // secret-style flag would leak it. Key + type is enough to reconstruct.
      details: { key, valueType: typeof value },
    }).catch(() => {});

    return success({ key, value }, 'Feature flag updated');
  } catch (error) {
    logger.error('[FEATURE_FLAGS_PUT]', error);
    return errors.internal('Failed to update feature flags');
  }
}
