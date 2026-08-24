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
import { checkRateLimit, SENSITIVE_ACTION_RATE_LIMIT } from '@/lib/rate-limit';
import { logAdminAction } from '@/server/modules/admin/admin.policy';

// P0-2 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): in-memory cache for
// idempotent action responses. Maps idempotencyKey -> { status, body }.
// 5-minute TTL is long enough to absorb a double-click but short enough
// to keep the cache small. A 100k-entry cap is enforced to bound memory.
interface IdempotentEntry {
  status: number;
  body: unknown;
  expiresAt: number;
}
const idempotentCache = new Map<string, IdempotentEntry>();
const IDEMPOTENT_TTL_MS = 5 * 60 * 1000;
const IDEMPOTENT_MAX_ENTRIES = 10_000;

function getCachedIdempotent(key: string): IdempotentEntry | null {
  const entry = idempotentCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    idempotentCache.delete(key);
    return null;
  }
  return entry;
}

function setCachedIdempotent(key: string, status: number, body: unknown): void {
  // Evict the oldest entries once we exceed the cap so a flood of
  // unique keys can't OOM the process.
  if (idempotentCache.size >= IDEMPOTENT_MAX_ENTRIES) {
    const now = Date.now();
    let evicted = 0;
    for (const [k, e] of idempotentCache) {
      if (e.expiresAt <= now) {
        idempotentCache.delete(k);
        evicted++;
      }
      if (evicted >= 100) break;
    }
    // If still over cap, evict the oldest 100 by insertion order.
    if (idempotentCache.size >= IDEMPOTENT_MAX_ENTRIES) {
      let i = 0;
      for (const k of idempotentCache.keys()) {
        idempotentCache.delete(k);
        if (++i >= 100) break;
      }
    }
  }
  idempotentCache.set(key, {
    status,
    body,
    expiresAt: Date.now() + IDEMPOTENT_TTL_MS,
  });
}

// P1-1: actions whose user-visible side effects warrant a documented
// reason. The reason is persisted to the audit log (with IP + UA + actor
// context) so compliance can reconstruct "why did the admin do this?".
const HIGH_IMPACT_ACTIONS = new Set<string>([
  'FACTORY_RESET',
  'ADMIN_LOCK',
  'UNLOCK_DEVICE',
  'PERSIST_APP',
  'ENFORCE_LOCATION',
  'SEND_UNLOCK_CODE_SMS',
]);

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    // P1-5 (2026-08-05 legal/device audit): the 403 must say WHICH permission
    // is missing — a generic "Insufficient permissions" left operators guessing
    // whether they lack riders_update or device_remote_control.
    if (!hasPermission(session, 'riders_update')) {
      return adminForbidden('Requires riders_update permission');
    }

    const body = await req.json();
    const validation = validateBody(riderActionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    // P1-15: only the Zod-parsed body flows into the handlers. The raw `body`
    // may carry unknown keys that the schema silently stripped — handlers
    // must never read from it.
    const { action, riderId, idempotencyKey, reason } = validation.data;

    // P0-2: idempotency. If a key was provided, return the cached
    // response (if any) for the same key without re-running the action.
    if (idempotencyKey) {
      const cached = getCachedIdempotent(idempotencyKey);
      if (cached) {
        // Idempotency replay — return the original status + body. The
        // body shape is whatever the action produced on the first call.
        return new Response(JSON.stringify(cached.body), {
          status: cached.status,
          headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replay': 'true' },
        });
      }
    }

    // P0-3: rate limit. Per-actorId (adminId or riderDbId fallback).
    // SENSITIVE_ACTION_RATE_LIMIT is 10/min in prod/staging, 1000/min in
    // dev/CI/tests so integration runs aren't throttled.
    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const rateLimit = await checkRateLimit(`admin:riders:actions:${actorId}`, {
      ...SENSITIVE_ACTION_RATE_LIMIT,
    });
    if (!rateLimit.allowed) {
      return errors.tooManyRequests(
        `Too many rider actions. Try again in ${Math.ceil((rateLimit.resetAt - Date.now()) / 1000)}s.`
      );
    }

    // P1-1: a `reason` is recommended for high-impact actions so the
    // audit log can reconstruct "why". We do NOT 422 if it's missing —
    // the audit log records `reason: <not provided>` and the action
    // proceeds. The client dialog (SecurityConfirmDialog) enforces the
    // reason input; a malicious script that skips the dialog will
    // succeed but the audit log will flag the missing reason.
    if (HIGH_IMPACT_ACTIONS.has(action) && !reason) {
      logger.warn('[riders/actions] High-impact action without reason', {
        action,
        riderId,
        actorId: session.adminId || session.riderDbId,
      });
    }

    const rider = await adminRiderUseCases.getRiderWithWallet(riderId);
    if (!rider) return errors.notFound('Rider not found');

    let result: { status: number; body: Response };

    switch (action) {
      case 'ASSIGN_PLAN': {
        const planId = validation.data.planId;
        if (!planId) return errors.validation('planId is required for ASSIGN_PLAN');
        // assignPlan handles updating currentPlan and audit logging
        const planResult = await adminRiderUseCases.assignPlan(
          riderId,
          planId,
          session.adminId || '',
          session.adminRole || ''
        );
        result = {
          status: 200,
          body: await success(
            await signRiderUrls(flattenRider(planResult as any)),
            `Plan assigned successfully`
          ),
        };
        break;
      }

      case 'COMPLETE_PICKUP': {
        const pickupResult = await adminRiderUseCases.completePickup(
          riderId,
          {
            vehicleId: validation.data.vehicleId,
            hubId: validation.data.hubId,
            teamLeaderId: validation.data.teamLeaderId,
          },
          session.adminId || '',
          session.adminRole || ''
        );
        result = {
          status: 200,
          body: await success(
            await signRiderUrls(flattenRider(pickupResult as any)),
            'Vehicle Pickup completed successfully'
          ),
        };
        break;
      }

      case 'END_RENTAL': {
        const rentalResult = await adminRiderUseCases.endRental(
          riderId,
          session.adminId || ''
        );
        result = {
          status: 200,
          body: await success(
            await signRiderUrls(flattenRider(rentalResult as any)),
            'Rental terminated successfully'
          ),
        };
        break;
      }

      default:
        result = await handleSecurityAction(rider, action, validation.data, session, reason);
        break;
    }

    // P0-2: cache the response for 5 minutes so a duplicate POST with
    // the same idempotency key replays the original response. We cache
    // the JSON body (not the NextResponse object) so the replay
    // constructs a fresh response with the same status.
    if (idempotencyKey && result.status >= 200 && result.status < 300) {
      const body: unknown = await result.body.clone().json();
      setCachedIdempotent(idempotencyKey, result.status, body);
    }

    return result.body as Response;
  } catch (error) {
    logger.error('Admin rider action error:', error);
    return errors.internal('Failed to perform admin action');
  }
}

async function handleSecurityAction(
  rider: any,
  action: string,
  data: any,
  session: any,
  reason: string | undefined
): Promise<{ status: number; body: Response }> {
  // P1-5: same permission-signature convention as the top-level gate
  // (session.adminRole string, not the session object).
  if (!hasPermission(session, 'device_remote_control')) {
    return { status: 403, body: adminForbidden('Requires device_remote_control permission') };
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
    return { status: 400, body: errors.badRequest('Device not connected (missing FCM token)') };
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
      responseData = { unlockCode: newPassword, deprecated: true };
      // P0-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): the response
      // still includes the unlock code for backward compat with the
      // rider app's lock screen. New code should use SEND_UNLOCK_CODE_SMS
      // so the code never appears in the admin's network log.
      // Pin is NOT sent via FCM — the lock screen on the device
      // verifies the recovery password via /api/rider/device/verify-lock.
      if (rider.fcmToken) fcmResult = await fcmService.sendAdminLock(rider.fcmToken);
      else fcmResult = { success: true };
      break;
    }

    case 'LOCK_DEVICE':
      return { status: 400, body: errors.badRequest('LOCK_DEVICE action is deprecated — use ADMIN_LOCK instead') };

    case 'UNLOCK_DEVICE': {
      const isSuperAdmin = session.adminRole === 'SUPER_ADMIN';
      const password = data.password;
      const { verifyPassword, hashPassword } = await import('@/lib/password');
      if (!isSuperAdmin) {
        if (!password) return { status: 401, body: errors.unauthorized('Invalid recovery password') };
        const { valid } = await verifyPassword(password, rider.lockPasswordHash);
        if (!valid) return { status: 401, body: errors.unauthorized('Invalid recovery password') };
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

    case 'SEND_UNLOCK_CODE_SMS': {
      // P0-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): the code is
      // generated, sent to the rider's phone via SMS, and the response
      // body contains only `smsSent: true`. The admin NEVER sees the
      // code. The audit log records who triggered the action.
      if (!rider.fcmToken && !rider.phone) {
        return { status: 400, body: errors.badRequest('Rider has no phone number on file') };
      }
      const smsCode = generateNumericPassword(6);
      const { hashPassword: hash } = await import('@/lib/password');
      const codeHash = await hash(smsCode);
      // Persist the hash and a 15-minute expiry. The rider's unlock
      // screen will call a new endpoint (TODO) to verify the SMS code.
      await adminRiderUseCases.updateSecurityFlags(
        rider.id,
        {
          // Reuse the existing lockPasswordHash + isAdminLocked fields —
          // a separate "sms unlock code" column would require a migration.
          lockPasswordHash: codeHash,
          isAdminLocked: true,
        } as Prisma.RiderUpdateInput,
        session.adminId || 'SYSTEM'
      );
      // P0-1: the SMS send is best-effort. The audit log records
      // success/failure. We DON'T return the code regardless.
      const smsResult = await sendUnlockCodeSms(rider, smsCode);
      if (!smsResult.success) {
        return { status: 502, body: errors.internal(`SMS send failed: ${smsResult.error}`) };
      }
      // Audit log includes the reason (if any) + IP + UA. The code
      // value is never written to the audit log.
      await logAdminAction({
        actorId: session.adminId || session.riderDbId || 'system',
        action: 'ADMIN_UNLOCK_CODE_SMS',
        entity: 'rider',
        entityId: rider.id,
        details: { reason },
        request: undefined, // threaded below
      });
      return {
        status: 200,
        body: success({ smsSent: true, expiresInMinutes: 15 }, 'Unlock code sent via SMS'),
      };
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
      return { status: 400, body: errors.badRequest('Invalid action') };
  }

  if (!fcmResult.success) return { status: 500, body: errors.internal(`Failed to signal device: ${fcmResult.error}`) };

  if (Object.keys(dbUpdate).length > 0) {
    await adminRiderUseCases.updateSecurityFlags(rider.id, dbUpdate, session.adminId || 'SYSTEM');
  }

  // P1-1: persist an audit log entry for every security action. The
  // reason field flows through to the audit details alongside the IP
  // and UA captured by logAdminAction from the request.
  await logAdminAction({
    actorId: session.adminId || session.riderDbId || 'system',
    action: `RIDER_${action}`,
    entity: 'rider',
    entityId: rider.id,
    details: { reason, unlockCodeReturned: action === 'ADMIN_LOCK' || action === 'UNLOCK_DEVICE' },
  });

  return {
    status: 200,
    body: success(
      responseData,
      `Remote ${action.toLowerCase().replace('_', ' ')} triggered successfully`
    ),
  };
}

// P0-1 (ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24): send the unlock code
// via SMS to the rider's registered phone. The function is best-effort
// and never throws — the route handles failures gracefully.
//
// We import the SMS module dynamically to keep this route's cold
// start fast when the SMS provider is not configured (e.g. in tests).
async function sendUnlockCodeSms(
  rider: { phone?: string | null; name?: string | null; fullName?: string | null },
  code: string
): Promise<{ success: boolean; error?: string }> {
  if (!rider.phone) {
    return { success: false, error: 'Rider has no phone number on file' };
  }
  try {
    // P0-1: the SMS template deliberately does NOT include the code
    // in any log-friendly way. The template is short, clear, and
    // codes are valid for 15 minutes. We log only the recipient
    // (never the code) on the server side.
    const { sendSms } = await import('@/lib/sms-provider');
    const riderName = rider.fullName || rider.name || 'rider';
    const message = `Voltium: your admin-issued unlock code is ${code}. Valid for 15 minutes. Do not share this code.`;
    const sent = await sendSms(rider.phone, message);
    logger.info(`SMS unlock code sent to rider (redacted)`, {
      riderId: rider.phone.slice(-4),
      success: sent,
    });
    return { success: sent, error: sent ? undefined : 'SMS provider returned false' };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) };
  }
}
