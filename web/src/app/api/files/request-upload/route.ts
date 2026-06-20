import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { requireAdmin } from '@/lib/rbac';
import { fileUseCases } from '@/server/modules/files/files.use-cases';
import { requestUploadUrlSchema } from '@/server/modules/files/files.schemas';

export async function POST(request: NextRequest) {
  try {
    const riderSession = await requireRiderSession(request);
    const adminSession = await requireAdmin();

    if (!riderSession && !adminSession) {
      return errors.unauthorized('Authentication required');
    }

    const body = await request.json();
    const validation = validateBody(requestUploadUrlSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const actor = adminSession
      ? { role: 'admin' as const, adminId: adminSession.adminId || adminSession.riderDbId }
      : { role: 'rider' as const, riderDbId: (riderSession as { riderDbId: string }).riderDbId };

    const result = await fileUseCases.requestUploadUrl(validation.data, actor);

    return success(
      {
        uploadUrl: result.uploadUrl,
        fileRecordId: result.fileRecordId,
        storageKey: result.storageKey,
        uploadToken: result.uploadToken,
        expiresIn: result.expiresIn,
      },
      'Upload URL generated'
    );
  } catch (err: any) {
    if (err.message?.includes('Invalid file type') || err.message?.includes('File too large')) {
      return errors.badRequest(err.message);
    }
    return errors.internal('Failed to generate upload URL');
  }
}
