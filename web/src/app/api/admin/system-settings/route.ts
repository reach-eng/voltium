import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { withApiHandler } from '@/lib/api-handler';
import { success, errors } from '@/lib/api-response';

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

  return success({ editable, readOnly });
});

export const PUT = withApiHandler(async (request: NextRequest) => {
  const session = await getAdminSession(request);
  if (!session) {
    return errors.unauthorized('Unauthorized');
  }

  // Only SUPER_ADMIN can edit system settings
  if (session.role !== 'SUPER_ADMIN') {
    return errors.forbidden('Forbidden: SUPER_ADMIN required');
  }

  const body = await request.json();
  const { key, value } = body;

  if (!key || value === undefined) {
    return errors.badRequest('key and value are required');
  }

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
