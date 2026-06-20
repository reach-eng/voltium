import { NextRequest } from 'next/server';
import { requireRiderSession } from '@/lib/rider-auth';
import { requireAdmin } from '@/lib/rbac';
import { fileUseCases } from './files.use-cases';
import { success, errors } from '@/lib/api-response';

export async function GET_verifyAccess(request: NextRequest) {
  const fileRecordId = request.nextUrl.searchParams.get('fileRecordId');
  if (!fileRecordId) {
    return errors.badRequest('fileRecordId parameter is required');
  }

  const riderSession = await requireRiderSession(request);
  const adminSession = await requireAdmin();

  if (!riderSession && !adminSession) {
    return errors.unauthorized('Authentication required');
  }

  const permissions = adminSession ? (adminSession as any).permissions : undefined;

  const result = await fileUseCases.verifyFileAccess(fileRecordId, {
    role: adminSession ? 'admin' : 'rider',
    riderDbId: (riderSession as any)?.riderDbId,
    adminId: (adminSession as any)?.adminId,
    permissions,
  });

  if (!result.allowed) {
    return errors.forbidden(result.reason || 'Access denied');
  }

  return success({ allowed: true });
}
