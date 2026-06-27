import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let riderDbId = '';
    if (process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'development') {
      const body = await request.clone().json();
      riderDbId = body.riderId || 'test-rider-001';
    } else {
      const auth = await requireRiderSession(request);
      if (auth instanceof Response) return auth;
      riderDbId = auth.riderDbId;
    }

    const body = await request.json();
    const { permissions } = body;

    if (!permissions || typeof permissions !== 'object') {
      return errors.badRequest('Permissions map is required');
    }

    // Map keys to match DB fields if needed, or update DB columns
    // The DB expectations in deviceComplianceUseCases.syncState:
    // database keys: locationGranted, batteryGranted, contactsGranted, callLogsGranted, micGranted, cameraGranted, phoneGranted, deviceAdminGranted, displayOverlayGranted
    const dbPermissions: Record<string, boolean> = {};
    if (typeof permissions.location === 'boolean') dbPermissions.locationGranted = permissions.location;
    if (typeof permissions.battery === 'boolean') dbPermissions.batteryGranted = permissions.battery;
    if (typeof permissions.contacts === 'boolean') dbPermissions.contactsGranted = permissions.contacts;
    if (typeof permissions.callLog === 'boolean') dbPermissions.callLogsGranted = permissions.callLog;
    if (typeof permissions.mic === 'boolean') dbPermissions.micGranted = permissions.mic;
    if (typeof permissions.camera === 'boolean') dbPermissions.cameraGranted = permissions.camera;
    if (typeof permissions.phone === 'boolean') dbPermissions.phoneGranted = permissions.phone;
    if (typeof permissions.deviceAdmin === 'boolean') dbPermissions.deviceAdminGranted = permissions.deviceAdmin;
    if (typeof permissions.displayOverApps === 'boolean') dbPermissions.displayOverlayGranted = permissions.displayOverApps;

    await deviceComplianceUseCases.syncState(riderDbId, dbPermissions);

    return success({ success: true }, 'Permissions synced successfully');
  } catch (err) {
    logger.error('[POST /api/device/permissions]', err);
    return errors.internal('Failed to sync permissions');
  }
}
