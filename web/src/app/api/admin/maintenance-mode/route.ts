import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
// PR-3 (2026-08-06 fix plan): invalidate the middleware's in-memory cache
// on toggle so the rider API reflects the change immediately (not after the
// 5s TTL).
import { invalidateMaintenanceCache } from '@/lib/maintenance-cache';

// PR-90 (API N12): envelope consistency. The original implementation
// returned `NextResponse.json({error: '...'})` for every failure
// case, which means clients had to read two different shapes (the
// envelope and the raw body) to handle errors. The route is on the
// shared `success()` / `errors.*()` envelope with the real cause
// logged (instead of echoed back to the caller).
//
// P0-5 (2026-08-05 ops audit): the 500 bodies were the generic
// 'Internal error' while every other route uses 'Failed to ...' —
// fixed to match the standard pattern.

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
    return errors.internal('Failed to fetch maintenance status');
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

    // PR-3: drop the middleware's cache so the next rider request sees the
    // new state instantly instead of within the 5s TTL window.
    invalidateMaintenanceCache();

    return success({ enabled, message });
  } catch (err: unknown) {
    logger.error('[admin/maintenance-mode] PUT failed', err);
    return errors.internal('Failed to update maintenance mode');
  }
}

/**
 * PATCH — update ONLY the banner message without touching `enabled`.
 * PR-2 (2026-08-06 verification report, Section 2): the old Save-message
 * button sent the current `enabled` state back on every save, so toggling
 * maintenance off and then saving a draft message would silently re-enable
 * maintenance mode. Decoupling the two writes removes that footgun.
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return errors.unauthorized('Unauthorized');
    }

    if (!hasPermission(session, 'settings_manage')) {
      return errors.forbidden('Forbidden: settings_manage permission required');
    }

    const body = await request.json();
    const { message } = body;

    if (typeof message !== 'string' || message.trim().length === 0) {
      return errors.badRequest('message field is required');
    }

    await db.systemSetting.upsert({
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
    });

    await createAuditLog({
      actorId: session.adminId || session.riderDbId || 'unknown',
      actorType: 'ADMIN',
      action: 'MAINTENANCE_MESSAGE_UPDATED',
      entity: 'SystemSetting',
      entityId: 'MAINTENANCE_MESSAGE',
      details: { message },
    });

    invalidateMaintenanceCache();

    return success({ message });
  } catch (err: unknown) {
    logger.error('[admin/maintenance-mode] PATCH failed', err);
    return errors.internal('Failed to update maintenance message');
  }
}
