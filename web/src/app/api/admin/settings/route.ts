import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { invalidateCache } from '@/lib/cache';
import { settingUseCases } from '@/server/modules/settings/setting.use-cases';
import { updateSettingsAdminSchema } from '@/lib/validators/admin';

/**
 * Business Settings API — one of TWO admin surfaces on the shared
 * `systemSetting` table. They must not be confused:
 *
 * ┌─────────────────────┬──────────────────────────┬────────────────────────────┐
 * │ Surface             │ THIS route (admin/settings) │ /api/admin/system-settings │
 * ├─────────────────────┼──────────────────────────┼────────────────────────────┤
 * │ Scope               │ BUSINESS registry keys     │ Infra/config keys          │
 * │                     │ (pricing, policy, contact) │ (APP_PUBLIC_URL, BACKUP_*) │
 * │ Permission          │ any role with              │ settings_manage AND        │
 * │                     │ settings_manage            │ SUPER_ADMIN                │
 * │ Body shape          │ multi-key map, rupees in   │ single {key, value}, raw   │
 * │                     │ (coerced to paise server-  │ strings                    │
 * │                     │ side)                      │                            │
 * │ Honors isEditable   │ yes (via settingUseCases.  │ yes (route-level guard)    │
 * │                     │ update, P1-6 audit fix)    │                            │
 * └─────────────────────┴──────────────────────────┴────────────────────────────┘
 *
 * Both flows upsert the same table and honor `isEditable`, so a frozen
 * row is frozen for both. Which keys belong to which surface is decided
 * by the registry category (`SETTING_REGISTRY`) plus the allowlist in
 * `updateSettingsAdminSchema`. See tests/unit/settings-p1-hardening.test.ts
 * for the contract tests pinning the split.
 */

export async function GET() {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    const result = await settingUseCases.getAll();
    return withCacheHeaders(success(result), 60);
  } catch (error) {
    logger.error('GET /api/admin/settings error:', error);
    return errors.internal('Failed to fetch settings');
  }
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'settings_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = updateSettingsAdminSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const results = await settingUseCases.update(
      validation.data,
      session.adminId ?? session.riderDbId ?? 'system'
    );
    // P1-19/P3-16: 'admin:*' nuked EVERY admin cache (dashboards, sessions,
    // lists) on any settings change. Scope to the settings cache key.
    invalidateCache('admin:settings:*');
    return success(results, 'Settings updated');
  } catch (error) {
    logger.error('PUT /api/admin/settings error:', error);
    // P2-18: an unknown key used to blow up as a 500 inside the use-case's
    // SETTINGS_BY_KEY.get(key)! — surface it as a client error instead.
    const message = error instanceof Error ? error.message : String(error);
    if (message.startsWith('Unknown setting key')) {
      return errors.badRequest(message);
    }
    return errors.internal('Failed to update settings');
  }
}
