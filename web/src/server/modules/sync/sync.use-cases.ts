import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export const syncUseCases = {
  async queueActions(riderDbId: string, actions: Array<{ actionType: string; payload?: any; endpoint?: string; method?: string }>) {
    const validActionTypes = new Set(['CREATE_TICKET', 'UPLOAD_INSPECTION', 'UPDATE_PROFILE', 'SUBMIT_KYC', 'SUBMIT_TOPUP']);

    const results: Array<{ actionType: string; status: 'QUEUED' | 'FAILED'; error?: string }> = [];

    for (const action of actions) {
      const { actionType, payload, endpoint, method } = action;

      if (!validActionTypes.has(actionType)) {
        results.push({ actionType, status: 'FAILED', error: `Invalid action type: ${actionType}` });
        continue;
      }
      if (!endpoint || !method) {
        results.push({ actionType, status: 'FAILED', error: 'Endpoint and method required' });
        continue;
      }

      await db.syncQueue.create({
        data: { riderId: riderDbId, actionType, payload: JSON.stringify(payload ?? {}), endpoint: endpoint || '', method: (method || 'POST').toUpperCase(), status: 'PENDING' },
      });
      results.push({ actionType, status: 'QUEUED' });
    }

    logger.info('Sync queue items added', { riderId: riderDbId, count: results.length });
    return { queued: results.filter((r) => r.status === 'QUEUED').length, results };
  },

  async getPending(riderDbId: string) {
    const queue = await db.syncQueue.findMany({
      where: { riderId: riderDbId, status: { in: ['PENDING', 'SYNCING', 'FAILED'] } },
      orderBy: { createdAt: 'asc' },
    });

    const pending = queue.filter((q) => q.status === 'PENDING' || q.status === 'FAILED');
    const syncing = queue.filter((q) => q.status === 'SYNCING');

    return {
      pending: pending.map((q) => ({ id: q.id, actionType: q.actionType, endpoint: q.endpoint, method: q.method, retryCount: q.retryCount, createdAt: q.createdAt })),
      syncing: syncing.length,
      totalPending: pending.length,
    };
  },
};
