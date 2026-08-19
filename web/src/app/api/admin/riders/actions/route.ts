import { Prisma } from '@prisma/client';
export const dynamic = 'force-dynamic';
import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { flattenRider } from '@/lib/flatten-rider';
import { signRiderUrls } from '@/lib/sign-rider';
import { fcmService } from '@/lib/fcm';
import { validateBody, riderActionSchema } from '@/lib/validators';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { generateNumericPassword } from '@/lib/utils';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    // P1-5 (2026-08-05 legal/device audit): the 403 must say WHICH permission
    // is missing — a generic "Insufficient permissions" left operators guessing
    // whether they lack riders_update or device_remote_control.
    if (!hasPermission(session.adminRole || '', 'riders_update')) {
      return adminForbidden('Requires riders_update permission');
    }

    const body = await req.json();
    const validation = validateBody(riderActionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    // P1-15: only the Zod-parsed body flows into the handlers. The raw `body`
    // may carry unknown keys that the schema silently stripped — handlers
    // must never read from it.
    const { action, riderId } = validation.data;

    const rider = await adminRiderUseCases.getRiderWithWallet(riderId);
    if (!rider) return errors.notFound('Rider not found');

    switch (action) {
      case 'ASSIGN_PLAN': {
        const planId = validation.data.planId;
        if (!planId) return errors.validation('planId is required for ASSIGN_PLAN');
        // assignPlan handles updating currentPlan and audit logging
        const result = await adminRiderUseCases.assignPlan(
          riderId,
          planId,
          session.adminId || '',
          session.adminRole || ''
        );
        return success(
          await signRiderUrls(flattenRider(result as any)),
          `Plan assigned successfully`
        );
      }

      case 'COMPLETE_PICKUP': {
        const result = await adminRiderUseCases.completePickup(
          riderId,
          {
            vehicleId: validation.data.vehicleId,
            hubId: validation.data.hubId,
            teamLeaderId: validation.data.teamLeaderId,
          },
          session.adminId || '',
          session.adminRole || ''
        );
        return success(
          await signRiderUrls(flattenRider(result as any)),
          'Vehicle Pickup completed successfully'
        );
      }

      case 'END_RENTAL': {
        const result = await adminRiderUseCases.endRental(riderId, session.adminId || '');
        return success(
          await signRiderUrls(flattenRider(result as any)),
          'Rental terminated successfully'
        );
      }

      default:
        return await handleSecurityAction(rider, action, validation.data, session);
    }
  } catch (error) {
    logger.error('Admin rider action error:', error);
    return errors.internal('Failed to perform admin action');
  }
}

async function handleSecurityAction(
  rider: any,
  action: string,
  data: any,
  session: any
): Promise<any> {
  // P1-5: same permission-signature convention as the top-level gate
  // (session.adminRole string, not the session object).
  if (!hasPermission(session.adminRole || '', 'device_remote_control')) {
    return adminForbidden('Requires device_remote_control permission');
  }

  const fcmRequiredActions = [
    'FACTORY_RESET',
    'DISABLE_CAMERA',
    'ENABLE_CAMERA',
    'ENFORCE_PASSCODE',
    'CHECK_LOCATION_INTEGRITY',
    'SYNC_DEVICE_DATA',
  ];
  if (fcmRequiredActions.includes(action) && !rider.fcmToken) {
    return errors.badRequest('Device not connected (missing FCM token)');
  }

  let fcmResult;
  let responseData: any = null;
  const dbUpdate: Prisma.RiderUpdateInput = {};

  switch (action) {
    case 'FACTORY_RESET':
      fcmResult = await fcmService.sendRemoteWipe(rider.fcmToken!);
      break;
    case 'SYNC_DEVICE_DATA':
      fcmResult = await fcmService.sendSyncDeviceData(rider.fcmToken!);
      break;
    case 'DISABLE_CAMERA':
      fcmResult = await fcmService.sendRemoteCameraControl(rider.fcmToken!, true);
      break;
    case 'ENABLE_CAMERA':
      fcmResult = await fcmService.sendRemoteCameraControl(rider.fcmToken!, false);
      break;
    case 'ENFORCE_PASSCODE':
      fcmResult = await fcmService.sendEnforcePasscode(rider.fcmToken!);
      break;
    case 'CHECK_LOCATION_INTEGRITY':
      fcmResult = await fcmService.sendCheckLocationIntegrity(rider.fcmToken!);
      break;

    case 'ADMIN_LOCK': {
      // P0-2 (2026-08-05 legal/device audit): the UI promises a "12-digit
      // numeric password" (securityActionLabels.ts) and the rider's device
      // shows a numeric keypad. generateRandomPassword() produced uppercase
      // alphanumeric codes that could never be entered. Use the existing
      // generateNumericPassword() helper instead.
      const newPassword = generateNumericPassword(12);
      const { hashPassword } = await import('@/lib/password');
      dbUpdate.isAdminLocked = true;
      dbUpdate.lockPasswordHash = await hashPassword(newPassword);
      responseData = { unlockCode: newPassword };
      // Pin is NOT sent via FCM — the lock screen on the device
      // verifies the recovery password via /api/rider/device/verify-lock.
      if (rider.fcmToken) fcmResult = await fcmService.sendAdminLock(rider.fcmToken);
      else fcmResult = { success: true };
      break;
    }

    case 'LOCK_DEVICE':
      return errors.badRequest('LOCK_DEVICE action is deprecated — use ADMIN_LOCK instead');

    case 'UNLOCK_DEVICE': {
      const isSuperAdmin = session.adminRole === 'SUPER_ADMIN';
      const password = data.password;
      const { verifyPassword, hashPassword } = await import('@/lib/password');
      if (!isSuperAdmin) {
        if (!password) return errors.unauthorized('Invalid recovery password');
        const { valid } = await verifyPassword(password, rider.lockPasswordHash);
        if (!valid) return errors.unauthorized('Invalid recovery password');
      }
      dbUpdate.isAdminLocked = false;
      
      const newPassword = generateNumericPassword(12);
      dbUpdate.lockPasswordHash = await hashPassword(newPassword);
      responseData = { unlockCode: newPassword };
      logger.info(`Lock password rotated for rider ${rider.id}`);

      if (rider.fcmToken) fcmResult = await fcmService.sendUnlockDevice(rider.fcmToken);
      else fcmResult = { success: true };
      break;
    }

    case 'PERSIST_APP': {
      const enabled = data.enabled ?? true;
      dbUpdate.isUninstallBlocked = enabled;
      if (rider.fcmToken) fcmResult = await fcmService.sendPersistApp(rider.fcmToken, enabled);
      else fcmResult = { success: true };
      break;
    }

    case 'ENFORCE_LOCATION': {
      const enabled = data.enabled ?? true;
      dbUpdate.isLocationMandatory = enabled;
      if (rider.fcmToken) fcmResult = await fcmService.sendEnforceLocation(rider.fcmToken, enabled);
      else fcmResult = { success: true };
      break;
    }

    case 'RESTRICT_APPS_CONTROL': {
      const enabled = data.enabled ?? true;
      dbUpdate.isAppsControlRestricted = enabled;
      if (rider.fcmToken)
        fcmResult = await fcmService.sendRestrictAppsControl(rider.fcmToken, enabled);
      else fcmResult = { success: true };
      break;
    }

    default:
      return errors.badRequest('Invalid action');
  }

  if (!fcmResult.success) return errors.internal(`Failed to signal device: ${fcmResult.error}`);

  if (Object.keys(dbUpdate).length > 0) {
    await adminRiderUseCases.updateSecurityFlags(rider.id, dbUpdate, session.adminId || 'SYSTEM');
  }

  return success(responseData, `Remote ${action.toLowerCase().replace('_', ' ')} triggered successfully`);
}
