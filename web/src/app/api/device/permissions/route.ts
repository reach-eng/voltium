import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  deviceComplianceUseCases,
  mapDevicePermissions,
} from '@/server/modules/device-compliance/device-compliance.use-cases';
import { logger } from '@/lib/logger';
import { isDeviceSeedAllowed } from '@/lib/device-policy';

// P1-4 (device-tracking audit, 2026-09-08): Zod envelope for the
// permissions payload. `permissions` is a permissive record (the
// use-case filters out unrecognized keys at the mapping step
// `mapDevicePermissions`); the rest of the envelope is strict.
const devicePermissionsSchema = z
  .object({
    permissions: z.record(z.string(), z.boolean()),
  })
  .strict();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let riderDbId = '';
    if (isDeviceSeedAllowed()) {
      // Dev / test bypass — body-supplied riderId is allowed in dev mode or
      // when running under the E2E test harness. Production and staging
      // (per device-policy.ts) always require a real session.
      const body = await request.clone().json().catch(() => ({}));
      riderDbId = body.riderId || 'test-rider-001';
    } else {
      const auth = await requireRiderSession(request);
      if (auth instanceof Response) return auth;
      riderDbId = auth.riderDbId;
    }

    // P1-4: rider-scoped rate limit. 5/min/rider, matches the
    // sync/data and rider/device routes in this PR.
    const rl = await checkRateLimit(`device-permissions:${riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many permission syncs. Try again in a minute.');
    }

    const body = await request.json().catch(() => null);
    const validation = devicePermissionsSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }
    const { permissions } = validation.data;

    // 2026-09-08 device-tracking audit P1-2: shared mapping — the verbatim
    // copy of this ladder lived here and in /api/rider/device/permissions.
    const dbPermissions = mapDevicePermissions(permissions);

    if (Object.keys(dbPermissions).length === 0) {
      return errors.badRequest('No recognized permission keys in payload');
    }

    await deviceComplianceUseCases.syncState(riderDbId, dbPermissions);

    return success({ success: true }, 'Permissions synced successfully');
  } catch (err) {
    logger.error('[POST /api/device/permissions]', err);
    return errors.internal('Failed to sync permissions');
  }
}
