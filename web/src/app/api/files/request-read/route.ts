import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { requireAdmin } from '@/lib/rbac';
import { fileUseCases } from '@/server/modules/files/files.use-cases';
import { requestReadUrlSchema } from '@/server/modules/files/files.schemas';

export async function POST(request: NextRequest) {
  try {
    const riderSession = await requireRiderSession(request);
    const adminSession = await requireAdmin();

    if (!riderSession && !adminSession) {
      return errors.unauthorized('Authentication required');
    }

    const body = await request.json();
    const validation = validateBody(requestReadUrlSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const permissions = adminSession ? (adminSession as any).permissions : undefined;

    const actor = adminSession
      ? {
          role: 'admin' as const,
          adminId: adminSession.adminId || adminSession.riderDbId,
          permissions,
        }
      : { role: 'rider' as const, riderDbId: (riderSession as { riderDbId: string }).riderDbId };

    const result = await fileUseCases.requestReadUrl(validation.data.fileRecordId, actor);

    return success(result, 'Read URL generated');
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return errors.notFound(err.message);
    }
    if (err.message?.includes('permission')) {
      return errors.forbidden(err.message);
    }
    return errors.internal('Failed to generate read URL');
  }
}
