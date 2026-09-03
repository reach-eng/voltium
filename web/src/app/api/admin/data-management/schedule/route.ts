import { NextRequest } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import { scheduleUpdateSchema } from '@/server/modules/data-management/backup.schemas';
import type { AdminRole } from '@/server/modules/admin/admin.types';
import { success, errors } from '@/lib/api-response';
import { hasPermission } from '@/lib/permissions';
import { logger } from '@/lib/logger';

// PR-90 (API N12): envelope consistency. The three handlers in this
// file used to write `NextResponse.json({success, data})` and
// `NextResponse.json({error: err.message})` directly. They now go
// through the shared `success()` / `errors.*()` envelope, and the
// 500 body is a generic 'Internal error' with the real cause logged
// instead of echoed into the response.

function isPermissionDenied(err: unknown): boolean {
  return err instanceof Error && err.message === 'Unauthorized';
}

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized('Unauthorized');

    if (!hasPermission(session, 'data_management_view')) {
      return errors.forbidden('Forbidden: insufficient permissions to view schedule');
    }

    const schedule = await dataManagementUseCases.getSchedule(session.adminRole as AdminRole);
    return success(schedule);
  } catch (err: unknown) {
    if (isPermissionDenied(err)) {
      return errors.forbidden('Forbidden: insufficient role to view schedule');
    }
    logger.error('[admin/data-management/schedule] GET failed', err);
    return errors.internal('Internal error');
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized('Unauthorized');

    if (!hasPermission(session, 'data_management_schedule')) {
      return errors.forbidden('Forbidden: insufficient permissions to update schedule');
    }

    const body = scheduleUpdateSchema.parse(await request.json());
    const schedule = await dataManagementUseCases.updateSchedule(
      body,
      session.adminId ?? '',
      session.adminRole as AdminRole
    );

    return success(schedule);
  } catch (err: unknown) {
    if (isPermissionDenied(err)) {
      return errors.forbidden('Forbidden: insufficient role to update schedule');
    }
    // Zod validation errors propagate with err.name === 'ZodError'.
    if (err instanceof Error && err.name === 'ZodError') {
      const details = (err as { errors?: unknown }).errors;
      return errors.validation('Validation failed', { details });
    }
    logger.error('[admin/data-management/schedule] PUT failed', err);
    return errors.internal('Internal error');
  }
}

// POST /api/admin/data-management/schedule?action=test
// POST /api/admin/data-management/schedule?action=run-now
export async function POST(request: NextRequest) {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized('Unauthorized');

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    if (action === 'test') {
      if (!hasPermission(session, 'data_management_test')) {
        return errors.forbidden('Forbidden: insufficient permissions to test schedule');
      }
      const result = await dataManagementUseCases.testSchedule(session.adminRole as AdminRole);
      return success(result);
    }

    if (action === 'run-now') {
      if (!hasPermission(session, 'data_management_backup')) {
        return errors.forbidden('Forbidden: insufficient permissions to run backup');
      }
      const result = await dataManagementUseCases.runScheduledBackupNow(
        session.adminId ?? '',
        session.adminRole as AdminRole
      );
      // P0-3 (2026-08-07 verification, Section 2 — Admin Data Mgmt): the
      // job is enqueued to the outbox and runs in the background — return
      // 202 Accepted, not 200 OK, so clients know the work isn't finished.
      return success(result, 'Backup job queued', 202);
    }

    return errors.badRequest('Invalid action. Use ?action=test or ?action=run-now');
  } catch (err: unknown) {
    if (isPermissionDenied(err)) {
      return errors.forbidden('Forbidden: insufficient role to run schedule action');
    }
    logger.error('[admin/data-management/schedule] POST failed', err);
    return errors.internal('Internal error');
  }
}
