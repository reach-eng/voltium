import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { requireAdmin } from '@/lib/rbac';
import { checkRateLimit, UPLOAD_RATE_LIMIT } from '@/lib/rate-limit';
import { fileUseCases } from '@/server/modules/files/files.use-cases';
import { requestUploadUrlSchema } from '@/server/modules/files/files.schemas';

export async function POST(request: NextRequest) {
  try {
    const riderSession = await requireRiderSession(request);
    const adminSession = await requireAdmin();

    if (!riderSession && !adminSession) {
      return errors.unauthorized('Authentication required');
    }

    // R10 polish #11 (SECURITY_PLAN §6.9): per-rider rate limit on upload URL
    // requests. Previously the UPLOAD_RATE_LIMIT constant was defined but
    // never invoked. We key on riderDbId (or adminId) so one user flooding
    // upload requests doesn't exhaust the limit for everyone behind a
    // shared NAT (which is what an IP-based limit would do).
    const actor = adminSession
      ? { role: 'admin' as const, adminId: adminSession.adminId || adminSession.riderDbId }
      : { role: 'rider' as const, riderDbId: (riderSession as { riderDbId: string }).riderDbId };

    const rlKey = actor.role === 'admin'
      ? `upload:admin:${actor.adminId}`
      : `upload:rider:${actor.riderDbId}`;
    const rl = await checkRateLimit(rlKey, UPLOAD_RATE_LIMIT);
    if (!rl.allowed) {
      return errors.tooManyRequests(
        `Upload rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.`,
      );
    }

    const body = await request.json();
    const validation = validateBody(requestUploadUrlSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

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
  } catch (err: unknown) {
    if ((err instanceof Error ? err.message : String(err))?.includes('Invalid file type') || (err instanceof Error ? err.message : String(err))?.includes('File too large')) {
      return errors.badRequest((err instanceof Error ? err.message : String(err)));
    }
    console.error('[POST /api/files/request-upload]', err);
    return errors.internal('Failed to generate upload URL');
  }
}
