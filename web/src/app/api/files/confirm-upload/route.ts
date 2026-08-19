import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { requireAdmin } from '@/lib/rbac';
import { fileUseCases } from '@/server/modules/files/files.use-cases';
import { confirmUploadSchema } from '@/server/modules/files/files.schemas';

export async function POST(request: NextRequest) {
  try {
    const riderSession = await requireRiderSession(request);
    const adminSession = await requireAdmin();

    const isRider = riderSession && !(riderSession instanceof Response);
    if (!isRider && !adminSession) {
      return errors.unauthorized('Authentication required');
    }

    const body = await request.json();
    const validation = validateBody(confirmUploadSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const actor = isRider
      ? { role: 'rider', riderDbId: riderSession.riderDbId }
      : { role: 'admin', adminId: adminSession?.adminId };

    const data = validation.data;
    const result = await fileUseCases.confirmUpload(
      data.fileRecordId,
      data.sizeBytes,
      data.checksum as string | undefined,
      actor
    );

    return success(result, 'File upload confirmed');
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('Forbidden')) {
      return errors.forbidden(msg);
    }
    if (msg.includes('not found')) {
      return errors.notFound(msg);
    }
    if (msg.includes('Upload the file first')) {
      return errors.badRequest(msg);
    }
    return errors.internal('Failed to confirm file upload');
  }
}
