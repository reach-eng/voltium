import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { validateBody, syncQueueSchema } from '@/lib/validators';
import { requireRiderSession } from '@/lib/rider-auth';
import { syncUseCases } from '@/server/modules/sync/sync.use-cases';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const validation = validateBody(syncQueueSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const result = await syncUseCases.queueActions(riderDbId, validation.data.actions);
    logger.info('Sync queue items added', { riderId: riderDbId, count: result.queued });

    return success(result, `${result.queued} actions queued for sync`);
  } catch (err) {
    logger.error('Sync queue POST failed', err);
    return errors.internal('Failed to queue actions');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const result = await syncUseCases.getPending(riderDbId);
    return success(result);
  } catch (err) {
    logger.error('Sync queue GET failed', err);
    return errors.internal('Failed to fetch sync queue');
  }
}
