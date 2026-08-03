import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { getAllFeatureFlags, updateFeatureFlag } from '@/lib/feature-flags';
import { createAuditLog } from '@/lib/audit-log';
import { invalidateCache } from '@/lib/cache';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    // Feature flags are static for long stretches — 60s browser cache + Vary by
    // Authorization keeps each admin's view isolated. The PUT handler below
    // invalidates the cache on any write so admins see their own changes.
    const flags = await getAllFeatureFlags();
    return withCacheHeaders(success(flags, 'Feature flags retrieved'), 60);
  } catch (error) {
    logger.error('[FEATURE_FLAGS_GET]', error);
    return errors.internal('Failed to fetch feature flags');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const { key, value } = body;

    if (!key || typeof value === 'undefined') {
      return errors.badRequest('Key and value are required');
    }

    const validKeys = [
      'enableReferralSystem',
      'enableRewardsSystem',
      'enableVehicleAssignment',
      'enableKYCVerification',
      'enableGuarantorRequirement',
      'enableDynamicPricing',
      'enableOfflineMode',
      'enableChatSupport',
      'enablePushNotifications',
      'maxUploadSizeMb',
    ];

    if (!validKeys.includes(key)) {
      return errors.badRequest(`Invalid feature flag key: ${key}`);
    }

    const updated = await updateFeatureFlag(key, String(value));
    if (!updated) {
      return errors.internal('Failed to update feature flag');
    }

    // Clear any feature-flag cache so the next GET reflects the new value
    // immediately instead of waiting up to 60s for the browser cache to expire.
    invalidateCache('admin:feature-flags:*');

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    createAuditLog({
      actorId,
      action: 'feature_flag.update',
      entity: 'feature_flags',
      entityId: key,
      details: { key, value },
    }).catch(() => {});

    return success({ key, value }, 'Feature flag updated');
  } catch (error) {
    logger.error('[FEATURE_FLAGS_PUT]', error);
    return errors.internal('Failed to update feature flags');
  }
}
