import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';
import { logger } from '@/lib/logger';
import { isDeviceSeedAllowed } from '@/lib/device-policy';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let riderDbId = '';
    if (isDeviceSeedAllowed()) {
      // Dev / test bypass — body-supplied riderId is allowed in dev mode or
      // when running under the E2E test harness. Production and staging
      // (per device-policy.ts) always require a real session.
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
