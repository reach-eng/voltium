import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

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

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch editable settings from DB
    const systemSettings = await db.systemSetting.findMany({
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });

    // Build editable settings map
    const editable: Record<string, { value: string; valueType: string; category: string; isSecret: boolean; isEditable: boolean; description: string | null }> = {};
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

    return NextResponse.json({ success: true, data: { editable, readOnly } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Only SUPER_ADMIN can edit system settings
    if (session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: SUPER_ADMIN required' }, { status: 403 });
    }

    const body = await request.json();
    const { key, value } = body;

    if (!key || value === undefined) {
      return NextResponse.json(
        { success: false, error: 'key and value are required' },
        { status: 400 }
      );
    }

    // Check if setting exists and is editable
    const existing = await db.systemSetting.findUnique({ where: { key } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: `Setting "${key}" not found` },
        { status: 404 }
      );
    }
    if (!existing.isEditable) {
      return NextResponse.json(
        { success: false, error: `Setting "${key}" is read-only` },
        { status: 403 }
      );
    }

    // Guard: if setting is a secret and value hasn't changed, skip update
    // This prevents saving the masked placeholder "[CONFIGURED]" as the actual value
    if (existing.isSecret && value === '[CONFIGURED]') {
      return NextResponse.json({ success: true, data: { key, value }, note: 'unchanged' });
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

    return NextResponse.json({ success: true, data: { key, value } });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}
