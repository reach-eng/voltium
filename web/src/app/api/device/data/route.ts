import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let riderDbId = '';
    const isProdOrStaging =
      process.env.APP_ENV === 'production' ||
      process.env.APP_ENV === 'staging' ||
      process.env.NODE_ENV === 'production';
    if (!isProdOrStaging && (process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'development')) {
      const body = await request.clone().json();
      riderDbId = body.riderId || 'test-rider-001';
    } else {
      const auth = await requireRiderSession(request);
      if (auth instanceof Response) return auth;
      riderDbId = auth.riderDbId;
    }

    const body = await request.json();
    const { type, data } = body;

    if (!type || !data) {
      return errors.badRequest('Type and data are required');
    }

    if (type === 'location') {
      await deviceComplianceUseCases.syncLocation(riderDbId, data);
    } else if (type === 'contacts') {
      if (Array.isArray(data)) {
        await deviceComplianceUseCases.syncContacts(riderDbId, data);
      }
    } else if (type === 'call_logs') {
      if (Array.isArray(data)) {
        await deviceComplianceUseCases.syncCallLogs(riderDbId, data);
      }
    }

    return success({ success: true }, 'Device data synced successfully');
  } catch (err) {
    logger.error('[POST /api/device/data]', err);
    return errors.internal('Failed to sync device data');
  }
}
