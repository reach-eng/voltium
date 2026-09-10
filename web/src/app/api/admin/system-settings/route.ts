import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { withApiHandler } from '@/lib/api-handler';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { hasPermission } from '@/lib/permissions';
import { updateSystemSettingSchema } from '@/lib/validators/admin';
import {
  INFRA_PUT_ALLOWED_KEYS,
  managedElsewhere,
  validateInfraKey,
} from './infra-key-validators';
import { SettingValidationError } from '@/server/modules/settings/settings.registry';

/**
 * Admin System Settings API
 *
 * P1-6 (settings audit, 2026-09-08): this is one of TWO admin surfaces
 * on the shared `systemSetting` table — see the split table in
 * `web/src/app/api/admin/settings/route.ts`. The short version: THIS
 * surface is single-key/raw-string/SUPER_ADMIN-only and owns LIVE
 * infrastructure config (storage roots, maintenance); the
 * `/api/admin/settings` surface is multi-key/rupees-in/any-
 * settings_manage-role and owns the BUSINESS registry keys. Both
 * honor `isEditable`, so a row frozen via either surface is frozen
 * for both.
 *
 * P0-1 (system-settings audit, 2026-09-08): the 10 rows below
 * previously listed as "editable" had ZERO runtime readers. They
 * remain in the table (the operator's last value is preserved for
 * forensic context) but their `isEditable` flag is `false` and the
 * description now points to where the knob actually lives:
 *   - `BACKUP_FREQUENCY`, `BACKUP_TIME_OF_DAY`, `BACKUP_TIMEZONE`,
 *     `BACKUP_KEEP_DAILY`, `BACKUP_KEEP_WEEKLY`, `BACKUP_KEEP_MONTHLY`,
 *     `BACKUP_KEEP_MANUAL`, `BACKUP_MINIMUM_FREE_DISK_GB` →
 *     Data Management → Schedule tab (`BackupSchedule` table).
 *   - `APP_PUBLIC_URL`, `API_BASE_URL` → `NEXT_PUBLIC_API_BASE_URL` env.
 *
 * Editable settings (stored in SystemSetting table):
 *   LOCAL_STORAGE_ROOT, BACKUP_ROOT, BACKUP_SECONDARY_ROOT,
 *   MAINTENANCE_MODE, MAINTENANCE_MESSAGE
 *
 * Read-only settings (displayed from env/status):
 *   NODE_ENV, APP_ENV, DATA_MODE, STORAGE_PROVIDER,
 *   ENABLE_TEST_OTP, ENABLE_DEV_ADMIN_LOGIN
 *
 * Read-only display (dead knobs — see P0-1):
 *   APP_PUBLIC_URL, API_BASE_URL, BACKUP_FREQUENCY,
 *   BACKUP_TIME_OF_DAY, BACKUP_TIMEZONE,
 *   BACKUP_KEEP_DAILY, BACKUP_KEEP_WEEKLY, BACKUP_KEEP_MONTHLY,
 *   BACKUP_KEEP_MANUAL, BACKUP_MINIMUM_FREE_DISK_GB
 */

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await getAdminSession(request);
  if (!session) {
    return errors.unauthorized('Unauthorized');
  }

  // P2-15: the GET previously had NO permission check — any admin (including
  // READ_ONLY) could read which secrets are configured. Align with the PUT.
  if (!hasPermission(session, 'settings_manage')) {
    return errors.forbidden('Forbidden: settings_manage permission required');
  }

  // Fetch editable settings from DB (P1: bound — config table, never unbounded).
  const systemSettings = await db.systemSetting.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
    take: 500,
  });

  // Build editable settings map
  const editable: Record<
    string,
    {
      value: string;
      valueType: string;
      category: string;
      isSecret: boolean;
      isEditable: boolean;
      description: string | null;
    }
  > = {};
  for (const s of systemSettings) {
    editable[s.key] = {
      value: s.isSecret ? '[CONFIGURED]' : s.value,
      valueType: s.valueType,
      category: s.category,
      isSecret: s.isSecret,
      isEditable: s.isEditable,
      description: s.description,
    };
  }

  // Build read-only status from env
  const readOnly: Record<string, string> = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_ENV: process.env.APP_ENV || 'development',
    DATA_MODE: process.env.DATA_MODE || 'local_laptop',
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
    ENABLE_TEST_OTP: process.env.ENABLE_TEST_OTP === 'true' ? 'enabled' : 'disabled',
    ENABLE_DEV_ADMIN_LOGIN: process.env.ENABLE_DEV_ADMIN_LOGIN === 'true' ? 'enabled' : 'disabled',
  };

  // P2-15/P2-16: "which secrets are configured" and "is the DB local or
  // remote" are infrastructure fingerprints — useful to a SUPER_ADMIN
  // debugging the box, useless (and leaky) to everyone else.
  if (session.adminRole === 'SUPER_ADMIN') {
    readOnly.DATABASE_HOST = (process.env.DATABASE_URL || '').includes('localhost')
      ? 'localhost'
      : 'remote';
    readOnly.DATABASE_URL_CONFIGURED = process.env.DATABASE_URL ? 'true' : 'false';
    readOnly.JWT_SECRET_CONFIGURED = process.env.JWT_SECRET ? 'true' : 'false';
    readOnly.SESSION_SECRET_CONFIGURED = process.env.SESSION_SECRET ? 'true' : 'false';
  }

  // P3-15: config pages must never serve stale data — the browser cache made
  // a PUT invisible for up to 60s. Zero cache here.
  return withCacheHeaders(success({ editable, readOnly }), 0);
});

export const PUT = withApiHandler(async (request: NextRequest) => {
  const session = await getAdminSession(request);
  if (!session) {
    return errors.unauthorized('Unauthorized');
  }

  // R4.3 / audit: was `session.role !== 'SUPER_ADMIN'` which is
  // always true (session.role is the user type 'admin'/'rider', the
  // role name lives in session.adminRole). Use hasPermission() which
  // resolves the right field and respects the policy matrix in
  // permissions-roles.ts.
  if (!hasPermission(session, 'settings_manage') || session.adminRole !== 'SUPER_ADMIN') {
    return errors.forbidden('Forbidden: Super Admin privileges required');
  }

  const body = await request.json();
  const validation = updateSystemSettingSchema.safeParse(body);
  if (!validation.success) {
    return errors.validation(validation.error.message);
  }

  const { key, value } = validation.data;

  // P0-2 (system-settings audit, 2026-09-08): allowlist the PUT to the
  // 5 LIVE infrastructure keys (LOCAL_STORAGE_ROOT, BACKUP_ROOT,
  // BACKUP_SECONDARY_ROOT, MAINTENANCE_MODE, MAINTENANCE_MESSAGE).
  // Business keys (referralBonus, lateFee, dailyRent, ...) live on the
  // /api/admin/settings surface with full rupee/paise coercion; flag.*
  // lives on the Feature Flags tab; the 10 dead knobs from PR-1 are
  // frozen. The check runs BEFORE the DB read so a non-allowlisted
  // key gets a clear 400 + the right surface pointer, not a 404.
  if (!INFRA_PUT_ALLOWED_KEYS.has(key)) {
    return errors.validation(managedElsewhere(key));
  }

  // Check if setting exists and is editable
  const existing = await db.systemSetting.findUnique({ where: { key } });
  if (!existing) {
    return errors.notFound(`Setting "${key}" not found`);
  }
  if (!existing.isEditable) {
    return errors.forbidden(`Setting "${key}" is read-only`);
  }

  // P0-2: per-key validation (PATH shape, BOOLEAN literal, message
  // length, etc.). The BUSINESS surface coerces via the registry; this
  // surface is the catch-up — it had raw-string acceptance for live
  // infra keys, and a typo like `BACKUP_KEEP_DAILY=abc` or a path
  // traversal in BACKUP_ROOT would persist. `validateInfraKey` either
  // returns the canonical value or throws SettingValidationError.
  let storedValue: string;
  try {
    storedValue = validateInfraKey(key, value);
  } catch (err) {
    if (err instanceof SettingValidationError) {
      return errors.validation(err.message);
    }
    throw err;
  }

  // Guard: if setting is a secret and value hasn't changed, skip update
  // This prevents saving the masked placeholder "[CONFIGURED]" as the actual value
  if (existing.isSecret && storedValue === '[CONFIGURED]') {
    // P2-17: tell the admin the request was a no-op — the old 'unchanged'
    // message looked like a silent success and invited re-submits.
    return success(
      { key, value: storedValue },
      'Setting unchanged — it is already configured'
    );
  }

  // Update the setting
  await db.systemSetting.update({
    where: { key },
    data: {
      value: storedValue,
      updatedByAdminId: session.adminId ?? session.riderDbId,
    },
  });

  // P1-1 (system-settings audit, 2026-09-08): the audit log used to
  // record `details: { key, isSecret }` only — the higher-blast-radius
  // surface (storage roots, maintenance state, URLs) had a weaker
  // trail than the BUSINESS surface on the same table. Mirror the
  // BUSINESS shape: per-key before/after with `[REDACTED]` for
  // secrets. No secrets exist today (see PR-4 / P1-3), but the field
  // is in the contract so a future secret row gets the right shape.
  await createAuditLog({
    actorId: session.adminId || session.riderDbId || 'unknown',
    actorType: 'ADMIN',
    action: 'system.config',
    entity: 'SystemSetting',
    entityId: key,
    details: {
      key,
      old: existing.isSecret ? '[REDACTED]' : existing.value,
      new: existing.isSecret ? '[REDACTED]' : storedValue,
      isSecret: existing.isSecret,
    },
  });

  return success({ key, value: storedValue });
});
