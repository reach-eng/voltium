import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const result = await dataManagementUseCases.getRestoreHistory(session.adminRole as AdminRole);
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    return NextResponse.json(
      { success: false, error: (err instanceof Error ? err.message : String(err)) },
      { status: (err instanceof Error ? err.message : String(err)) === 'Unauthorized' ? 403 : 500 }
    );
  }
}
