import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) return errors.badRequest('type and data are required');

    switch (type) {
      case 'CONTACTS':
        await deviceComplianceUseCases.syncContacts(riderDbId, data);
        return success(null, 'Contacts synced');

      case 'CALL_LOGS':
        await deviceComplianceUseCases.syncCallLogs(riderDbId, data);
        return success(null, 'Call logs synced');

      case 'LOCATION':
        await deviceComplianceUseCases.syncLocation(riderDbId, data);
        return success(null, 'Location updated');

      default:
        return errors.badRequest('Invalid sync type');
    }
  } catch (err) {
    logger.error('[POST /api/rider/sync/device-data]', err);
    return errors.internal('Failed to sync device data');
  }
}
