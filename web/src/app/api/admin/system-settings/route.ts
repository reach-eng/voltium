import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { withApiHandler } from '@/lib/api-handler';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { hasPermission } from '@/lib/permissions';
import { updateSystemSettingSchema } from '@/lib/validators/admin';

/**
 * Admin System Settings API
 *
 * Editable settings (stored in SystemSetting table):
 *   APP_PUBLIC_URL, API_BASE_URL, LOCAL_STORAGE_ROOT,
 *   BACKUP_ROOT, BACKUP_SECONDARY_ROOT, BACKUP_FREQUENCY,
 *   BACKUP_TIME_OF_DAY, BACKUP_TIMEZONE,
 *   BACKUP_KEEP_DAILY, BACKUP_KEEP_WEEKLY, BACKUP_KEEP_MONTHLY,
 *   BACKUP_KEEP_MANUAL, BACKUP_MINIMUM_FREE_DISK_GB
 *
 * Read-only settings (displayed from env/status):
 *   NODE_ENV, APP_ENV, DATA_MODE, STORAGE_PROVIDER,
 *   ENABLE_TEST_OTP, ENABLE_DEV_ADMIN_LOGIN
 */

export const GET = withApiHandler(async (request: NextRequest) => {
  const session = await getAdminSession(request);
  if (!session) {
    return errors.unauthorized('Unauthorized');
  }

  // Fetch editable settings from DB
  const systemSettings = await db.systemSetting.findMany({
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
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
  const readOnly = {
    NODE_ENV: process.env.NODE_ENV || 'development',
    APP_ENV: process.env.APP_ENV || 'development',
    DATA_MODE: process.env.DATA_MODE || 'local_laptop',
    STORAGE_PROVIDER: process.env.STORAGE_PROVIDER || 'local',
    DATABASE_HOST: (process.env.DATABASE_URL || '').includes('localhost') ? 'localhost' : 'remote',
    ENABLE_TEST_OTP: process.env.ENABLE_TEST_OTP === 'true' ? 'enabled' : 'disabled',
    ENABLE_DEV_ADMIN_LOGIN: process.env.ENABLE_DEV_ADMIN_LOGIN === 'true' ? 'enabled' : 'disabled',
    DATABASE_URL_CONFIGURED: process.env.DATABASE_URL ? 'true' : 'false',
    JWT_SECRET_CONFIGURED: process.env.JWT_SECRET ? 'true' : 'false',
    SESSION_SECRET_CONFIGURED: process.env.SESSION_SECRET ? 'true' : 'false',
  };

  return withCacheHeaders(success({ editable, readOnly }), 60);
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
  if (!hasPermission(session, 'settings_manage')) {
    return errors.forbidden('Forbidden: settings_manage permission required');
  }

  const body = await request.json();
  const validation = updateSystemSettingSchema.safeParse(body);
  if (!validation.success) {
    return errors.validation(validation.error.message);
  }

  const { key, value } = validation.data;

  // Check if setting exists and is editable
  const existing = await db.systemSetting.findUnique({ where: { key } });
  if (!existing) {
    return errors.notFound(`Setting "${key}" not found`);
  }
  if (!existing.isEditable) {
    return errors.forbidden(`Setting "${key}" is read-only`);
  }

  // Guard: if setting is a secret and value hasn't changed, skip update
  // This prevents saving the masked placeholder "[CONFIGURED]" as the actual value
  if (existing.isSecret && value === '[CONFIGURED]') {
    return success({ key, value }, 'unchanged');
  }

  // Update the setting
  await db.systemSetting.update({
    where: { key },
    data: {
      value,
      updatedByAdminId: session.adminId ?? session.riderDbId,
    },
  });

  // Audit log
  await createAuditLog({
    actorId: session.adminId || session.riderDbId || 'unknown',
    actorType: 'ADMIN',
    action: 'SYSTEM_CONFIG',
    entity: 'SystemSetting',
    entityId: key,
    details: { key, isSecret: existing.isSecret },
  });

  return success({ key, value });
});
