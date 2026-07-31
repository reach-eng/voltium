import { NextResponse } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { restoreUseCases } from '@/server/modules/data-management/restore/restore.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return errors.unauthorized();

    const result = await restoreUseCases.getRestoreHistory(session.adminRole as AdminRole);
    return success(result);
  } catch (err: unknown) {
    // Non-standard response shape — left as-is (conditional status by error message)
    return NextResponse.json(
      { success: false, error: (err instanceof Error ? err.message : String(err)) },
      { status: (err instanceof Error ? err.message : String(err)) === 'Unauthorized' ? 403 : 500 }
    );
  }
}
