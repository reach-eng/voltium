import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';

// PR-90 (API N12): envelope consistency. The original implementation
// returned `NextResponse.json({error: '...'})` for every failure
// case, which means clients had to read two different shapes (the
// envelope and the raw body) to handle errors. After this change the
// route is on the shared `success()` / `errors.*()` envelope and the
// 500 body is a generic 'Internal error' with the real cause logged
// (instead of echoed back to the caller).

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return errors.unauthorized('Unauthorized');
    }

    const [modeSetting, messageSetting] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } }),
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MESSAGE' } }),
    ]);

    return success({
      enabled: modeSetting?.value === 'true',
      message:
        messageSetting?.value ??
        'System is currently under maintenance. Please check back later.',
    });
  } catch (err: unknown) {
    logger.error('[admin/maintenance-mode] GET failed', err);
    return errors.internal('Internal error');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return errors.unauthorized('Unauthorized');
    }

    if (!hasPermission(session, 'settings_manage')) {
      return errors.forbidden('Forbidden: settings_manage permission required');
    }

    const body = await request.json();
    const { enabled, message } = body;

    if (enabled === undefined || message === undefined) {
      return errors.badRequest('enabled and message fields are required');
    }

    // Upsert key/value configs
    await Promise.all([
      db.systemSetting.upsert({
        where: { key: 'MAINTENANCE_MODE' },
        update: { value: String(enabled), updatedByAdminId: session.adminId ?? session.riderDbId },
        create: {
          key: 'MAINTENANCE_MODE',
          value: String(enabled),
          valueType: 'BOOLEAN',
          category: 'SERVER',
          description:
            'Whether the application is currently in maintenance mode blocking rider operations.',
          updatedByAdminId: session.adminId ?? session.riderDbId,
        },
      }),
      db.systemSetting.upsert({
        where: { key: 'MAINTENANCE_MESSAGE' },
        update: { value: message, updatedByAdminId: session.adminId ?? session.riderDbId },
        create: {
          key: 'MAINTENANCE_MESSAGE',
          value: message,
          valueType: 'STRING',
          category: 'SERVER',
          description: 'Banner message shown to riders when maintenance mode is active.',
          updatedByAdminId: session.adminId ?? session.riderDbId,
        },
      }),
    ]);

    await createAuditLog({
      actorId: session.adminId || session.riderDbId || 'unknown',
      actorType: 'ADMIN',
      action: enabled ? 'MAINTENANCE_ENABLED' : 'MAINTENANCE_DISABLED',
      entity: 'SystemSetting',
      entityId: 'MAINTENANCE_MODE',
      details: { enabled, message },
    });

    return success({ enabled, message });
  } catch (err: unknown) {
    logger.error('[admin/maintenance-mode] PUT failed', err);
    return errors.internal('Internal error');
  }
}
