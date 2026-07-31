import { NextRequest, NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { scheduleUseCases } from '@/server/modules/data-management/schedule/schedule.use-cases';
import { scheduleUpdateSchema } from '@/server/modules/data-management/backup/backup.schemas';
import type { AdminRole } from '@/server/modules/admin/admin.types';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized();

    const schedule = await scheduleUseCases.getSchedule(session.adminRole as AdminRole);
    return success(schedule);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return message === 'Unauthorized' ? errors.forbidden() : errors.internal(message);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized();

    const body = scheduleUpdateSchema.parse(await request.json());
    const schedule = await scheduleUseCases.updateSchedule(
      body,
      session.adminId ?? '',
      session.adminRole as AdminRole
    );

    return success(schedule);
  } catch (err: unknown) {
    const isZodError = err instanceof Error && err.name === 'ZodError';
    if (isZodError) {
      const details = typeof err === 'object' && err !== null && 'errors' in err
        ? (err as { errors: unknown }).errors
        : undefined;
      return errors.badRequest('Validation failed', { details });
    }
    const message = err instanceof Error ? err.message : String(err);
    return message === 'Unauthorized' ? errors.forbidden() : errors.internal(message);
  }
}

// POST /api/admin/data-management/schedule?action=test
// POST /api/admin/data-management/schedule?action=run-now
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized();

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'test') {
      const result = await scheduleUseCases.testSchedule(session.adminRole as AdminRole);
      // Non-standard response shape — left as-is (success mirrors test outcome, not API status)
      return NextResponse.json({ success: result.success, data: result });
    }

    if (action === 'run-now') {
      const result = await scheduleUseCases.runScheduledBackupNow(
        session.adminId ?? '',
        session.adminRole as AdminRole
      );
      return success(result);
    }

    return errors.badRequest('Invalid action. Use ?action=test or ?action=run-now');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return message === 'Unauthorized' ? errors.forbidden() : errors.internal(message);
  }
}
