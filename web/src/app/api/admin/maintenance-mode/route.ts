import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { hasPermission } from '@/lib/permissions';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [modeSetting, messageSetting] = await Promise.all([
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } }),
      db.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MESSAGE' } }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        enabled: modeSetting?.value === 'true',
        message:
          messageSetting?.value ??
          'System is currently under maintenance. Please check back later.',
      },
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // R4.3 / audit: was `session.role !== 'SUPER_ADMIN'` which is
    // always true (session.role is the user type 'admin'/'rider', the
    // role name lives in session.adminRole). The old check blocked
    // every real SUPER_ADMIN and would invert to a privilege hole if
    // "fixed" naively. Use hasPermission() which resolves the right
    // field.
    if (!hasPermission(session, 'settings_manage')) {
      return NextResponse.json(
        { error: 'Forbidden: settings_manage permission required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enabled, message } = body;

    if (enabled === undefined || message === undefined) {
      return NextResponse.json(
        { error: 'enabled and message fields are required' },
        { status: 400 }
      );
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

    return NextResponse.json({ success: true, data: { enabled, message } });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: (err instanceof Error ? err.message : String(err)) }, { status: 500 });
  }
}
