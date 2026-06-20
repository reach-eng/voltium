import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/get-session';
import { dataManagementUseCases } from '@/server/modules/data-management/data-management.use-cases';
import type { AdminRole } from '@/server/modules/admin/admin.types';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const storage = await dataManagementUseCases.getStorage(session.adminRole as AdminRole);
    return NextResponse.json({ success: true, data: storage });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message },
      { status: err.message === 'Unauthorized' ? 403 : 500 }
    );
  }
}
