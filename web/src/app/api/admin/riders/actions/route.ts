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
import { generateRandomPassword } from '@/lib/utils';
import { adminRiderUseCases } from '@/server/modules/riders/admin-riders.use-cases';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!hasPermission(session.adminRole || '', 'riders_update')) return adminForbidden();

    const body = await req.json();
    const validation = validateBody(riderActionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { action, riderId } = validation.data;

    const rider = await adminRiderUseCases.getRiderWithWallet(riderId);
    if (!rider) return errors.notFound('Rider not found');

    switch (action) {
      case 'ASSIGN_PLAN': {
        await adminRiderUseCases.update(riderId, { currentPlan: body.planId }, { actorId: session.adminId || '', actorRole: session.adminRole || '' });
        const result = await adminRiderUseCases.assignPlan(riderId, body.planId, body.planId, session.adminId || '', session.adminRole || '');
        return success(await signRiderUrls(flattenRider(result as any)), `Plan assigned successfully`);
      }

      case 'COMPLETE_PICKUP': {
        const result = await adminRiderUseCases.completePickup(riderId, { vehicleId: body.vehicleId, hubId: body.hubId, teamLeader: body.teamLeader }, session.adminId || '', session.adminRole || '');
        return success(await signRiderUrls(flattenRider(result as any)), 'Vehicle Pickup completed successfully');
      }

      case 'END_RENTAL': {
        const result = await adminRiderUseCases.endRental(riderId, session.adminId || '');
        return success(await signRiderUrls(flattenRider(result as any)), 'Rental terminated successfully');
      }

      default:
        return await handleSecurityAction(rider, action, body, session);
    }
  } catch (error) {
    logger.error('Admin rider action error:', error);
    return errors.internal('Failed to perform admin action');
  }
}

async function handleSecurityAction(rider: any, action: string, body: any, session: any): Promise<any> {
  if (!hasPermission(session, 'device_remote_control')) return adminForbidden();

  const fcmRequiredActions = ['LOCK_DEVICE', 'FACTORY_RESET', 'DISABLE_CAMERA', 'ENABLE_CAMERA', 'ENFORCE_PASSCODE', 'CHECK_LOCATION_INTEGRITY'];
  if (fcmRequiredActions.includes(action) && !rider.fcmToken) {
    return errors.badRequest('Device not connected (missing FCM token)');
  }

  let fcmResult;
  const dbUpdate: any = {};

  switch (action) {
    case 'LOCK_DEVICE': return errors.badRequest('LOCK_DEVICE action is disabled for security compliance.');
    case 'FACTORY_RESET': return errors.badRequest('FACTORY_RESET action is disabled for security compliance.');
    case 'DISABLE_CAMERA': fcmResult = await fcmService.sendRemoteCameraControl(rider.fcmToken!, true); break;
    case 'ENABLE_CAMERA': fcmResult = await fcmService.sendRemoteCameraControl(rider.fcmToken!, false); break;
    case 'ENFORCE_PASSCODE': fcmResult = await fcmService.sendEnforcePasscode(rider.fcmToken!); break;
    case 'CHECK_LOCATION_INTEGRITY': fcmResult = await fcmService.sendCheckLocationIntegrity(rider.fcmToken!); break;

    case 'ADMIN_LOCK': {
      const newPassword = generateRandomPassword(8);
      dbUpdate.isAdminLocked = true;
      dbUpdate.lockPassword = newPassword;
      if (rider.fcmToken) fcmResult = await fcmService.sendAdminLock(rider.fcmToken, newPassword);
      else fcmResult = { success: true };
      break;
    }

    case 'UNLOCK_DEVICE': {
      const isSuperAdmin = session.adminRole === 'SUPER_ADMIN';
      const password = body.password;
      if (!isSuperAdmin) {
        if (!password) return errors.unauthorized('Invalid recovery password');
        const { verifyPassword } = await import('@/lib/password');
        const valid = await verifyPassword(password, rider.lockPassword);
        if (!valid) return errors.unauthorized('Invalid recovery password');
      }
      dbUpdate.isAdminLocked = false;
      dbUpdate.lockPassword = generateRandomPassword(8);
      if (rider.fcmToken) fcmResult = await fcmService.sendUnlockDevice(rider.fcmToken);
      else fcmResult = { success: true };
      break;
    }

    case 'PERSIST_APP': {
      const enabled = body.enabled ?? true;
      dbUpdate.isUninstallBlocked = enabled;
      if (rider.fcmToken) fcmResult = await fcmService.sendPersistApp(rider.fcmToken, enabled);
      else fcmResult = { success: true };
      break;
    }

    case 'ENFORCE_LOCATION': {
      const enabled = body.enabled ?? true;
      dbUpdate.isLocationMandatory = enabled;
      if (rider.fcmToken) fcmResult = await fcmService.sendEnforceLocation(rider.fcmToken, enabled);
      else fcmResult = { success: true };
      break;
    }

    case 'RESTRICT_APPS_CONTROL': {
      const enabled = body.enabled ?? true;
      dbUpdate.isAppsControlRestricted = enabled;
      if (rider.fcmToken) fcmResult = await fcmService.sendRestrictAppsControl(rider.fcmToken, enabled);
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

  return success(null, `Remote ${action.toLowerCase().replace('_', ' ')} triggered successfully`);
}
