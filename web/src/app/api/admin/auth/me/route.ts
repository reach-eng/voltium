import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { adminUseCases } from '@/server/modules/admin/admin.use-cases';

export async function GET(_request: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return errors.unauthorized('Not authenticated');
  }

  const adminId = session.adminId || session.riderDbId;

  const admin = await adminUseCases.getMe(adminId);

  if (!admin.isActive) {
    return errors.forbidden('Account not found or deactivated');
  }

  return success(admin);
}
