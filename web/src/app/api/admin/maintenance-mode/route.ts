import { NextRequest, NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized();

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
    // Non-standard response shape — left as-is (flat error string, not standard error object)
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized();

    // Only SUPER_ADMIN can change maintenance mode in production.
    if (session.role !== 'SUPER_ADMIN') {
      return errors.forbidden('Forbidden: SUPER_ADMIN required');
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

    // Legacy Setting consolidated — maintenanceMode now lives in SystemSetting as MAINTENANCE_MODE

    // Audit logging
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
    // Non-standard response shape — left as-is (flat error string, not standard error object)
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
