import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { withApiHandler } from '@/lib/api-handler';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { hasPermission } from '@/lib/permissions';
import { updateSystemSettingSchema } from '@/lib/validators/admin';
// P1-2 (system-settings audit, 2026-09-08): when this surface writes
// MAINTENANCE_MODE / MAINTENANCE_MESSAGE it must drop the middleware's
// in-memory cache so the rider gate reflects the change instantly
// (not after the 5s TTL). The dedicated maintenance route already
// does this; the system-settings surface historically skipped it,
// fragmenting the maintenance control plane across two surfaces that
// disagree on cache semantics.
import { invalidateMaintenanceCache } from '@/lib/maintenance-cache';
// P1-4 (system-settings audit, 2026-09-08): storage roots are
// memoized in `StoragePathBuilder` (no TTL). Editing LOCAL_STORAGE_ROOT
// / BACKUP_ROOT / BACKUP_SECONDARY_ROOT through this surface used to
// change nothing until `invalidateCache()` was called manually, and
// even then the LOCAL process is the only one that resets — sibling
// workers in PM2 cluster mode keep the old value until restart. The
// PUT now calls `invalidateCache()` so the local process is correct
// immediately; the `requiresRestart` column on the row tells the
// operator that cluster siblings need a process restart.
import { StoragePathBuilder } from '@/lib/storage-path-builder';
import {
  INFRA_PUT_ALLOWED_KEYS,
  managedElsewhere,
  validateInfraKey,
  auditActionForKey,
  isMaintenanceKey,
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
 * P0-2 (system-settings audit, 2026-09-08): the PUT is now
 * allowlisted to the 5 LIVE infra keys below and per-key validated
 * (see `infra-key-validators.ts`). Business keys (referralBonus,
 * lateFee, dailyRent, ...), `flag.*`, and the 10 dead knobs are
 * refused with 400 + a surface pointer.
 *
 * P1-1 + P1-2 (system-settings audit, 2026-09-08): maintenance writes
 * from this surface invalidate the middleware cache (so the rider
 * gate reflects the change instantly, not after the 5s TTL) and emit
 * the same action names as the dedicated maintenance route
 * (`MAINTENANCE_ENABLED` / `MAINTENANCE_DISABLED` / `maintenance.message_updated`).
 * Other keys continue to emit `system.config` with a per-key
 * before/after diff.
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
      // P1-4 (system-settings audit, 2026-09-08): operator hint
      // that an edit needs a process restart to take effect on
      // all workers (PM2 cluster). The PUT also calls
      // `StoragePathBuilder.invalidateCache()` so the local
      // process is correct immediately, but cluster siblings need
      // a restart to reset their in-memory module cache.
      requiresRestart: boolean;
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
      requiresRestart: s.requiresRestart,
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

  // P1-2 (system-settings audit, 2026-09-08): the dedicated
  // maintenance route emits `MAINTENANCE_ENABLED` / `MAINTENANCE_DISABLED`
  // (PUT) and `maintenance.message_updated` (PATCH). The system-
  // settings surface historically emitted generic `system.config`
  // for the same events, fragmenting the maintenance incident
  // timeline across two action names for one event. Match the
  // maintenance route's names so a single toggle shows up under
  // a single action in the audit log.
  const action = auditActionForKey(key, storedValue);

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
    action,
    entity: 'SystemSetting',
    entityId: key,
    details: {
      key,
      old: existing.isSecret ? '[REDACTED]' : existing.value,
      new: existing.isSecret ? '[REDACTED]' : storedValue,
      isSecret: existing.isSecret,
    },
  });

  // P1-2: drop the middleware's in-memory maintenance cache so the
  // rider gate reflects the new state instantly (not after the 5s
  // TTL). The dedicated maintenance route already does this; do
  // it here too so the system-settings surface doesn't fragment
  // the cache state across the two writers.
  if (isMaintenanceKey(key)) {
    invalidateMaintenanceCache();
  }

  // P1-4: drop the StoragePathBuilder module cache so the local
  // process picks up the new root immediately. Sibling workers in
  // PM2 cluster mode keep the old value until restart — the
  // `requiresRestart` row metadata (read on GET) tells the operator
  // which keys need that restart.
  if (
    key === 'LOCAL_STORAGE_ROOT' ||
    key === 'BACKUP_ROOT' ||
    key === 'BACKUP_SECONDARY_ROOT'
  ) {
    StoragePathBuilder.invalidateCache();
  }

  return success({ key, value: storedValue });
});
