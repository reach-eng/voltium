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

    if (!riderSession && !adminSession) {
      return errors.unauthorized('Authentication required');
    }

    const body = await request.json();
    const validation = validateBody(confirmUploadSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const data = validation.data;
    const result = await fileUseCases.confirmUpload(
      data.fileRecordId,
      data.sizeBytes,
      data.checksum
    );

    return success(result, 'File upload confirmed');
  } catch (err: any) {
    if (err.message?.includes('not found')) {
      return errors.notFound(err.message);
    }
    if (err.message?.includes('Upload the file first')) {
      return errors.badRequest(err.message);
    }
    return errors.internal('Failed to confirm file upload');
  }
}
