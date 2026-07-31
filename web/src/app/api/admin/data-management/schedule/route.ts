import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import { scheduleUpdateSchema } from '@/server/modules/data-management/backup.schemas';
import type { AdminRole } from '@/server/modules/admin/admin.types';

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const schedule = await dataManagementUseCases.getSchedule(session.adminRole as AdminRole);
    return NextResponse.json({ success: true, data: schedule });
  } catch (err: unknown) {
    const message = errorMessage(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: message === 'Unauthorized' ? 403 : 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = scheduleUpdateSchema.parse(await request.json());
    const schedule = await dataManagementUseCases.updateSchedule(
      body,
      session.adminId ?? '',
      session.adminRole as AdminRole
    );

    return NextResponse.json({ success: true, data: schedule });
  } catch (err: unknown) {
    const isZodError = err instanceof Error && err.name === 'ZodError';
    if (isZodError) {
      const details = typeof err === 'object' && err !== null && 'errors' in err
        ? (err as { errors: unknown }).errors
        : undefined;
      return NextResponse.json(
        { success: false, error: 'Validation failed', details },
        { status: 400 }
      );
    }
    const message = errorMessage(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: message === 'Unauthorized' ? 403 : 500 }
    );
  }
}

// POST /api/admin/data-management/schedule?action=test
// POST /api/admin/data-management/schedule?action=run-now
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'test') {
      const result = await dataManagementUseCases.testSchedule(session.adminRole as AdminRole);
      return NextResponse.json({ success: result.success, data: result });
    }

    if (action === 'run-now') {
      const result = await dataManagementUseCases.runScheduledBackupNow(
        session.adminId ?? '',
        session.adminRole as AdminRole
      );
      return NextResponse.json({ success: true, data: result });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid action. Use ?action=test or ?action=run-now' },
      { status: 400 }
    );
  } catch (err: unknown) {
    const message = errorMessage(err);
    return NextResponse.json(
      { success: false, error: message },
      { status: message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
