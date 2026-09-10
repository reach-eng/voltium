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

// P1-4 (device-tracking audit, 2026-09-08): Zod envelope for the
// permissions payload. The use-case filters out unrecognized keys
// at `mapDevicePermissions`, so `permissions` stays permissive
// (`z.record(z.boolean())`); the rest of the envelope is strict.
const riderDevicePermissionsSchema = z
  .object({
    permissions: z.record(z.string(), z.boolean()),
  })
  .strict();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    // P1-4: rider-scoped rate limit. 5/min/rider, matches the
    // device/permissions route and the sync/data + rider/device
    // routes in this PR.
    const rl = await checkRateLimit(`rider-device-permissions:${riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many permission syncs. Try again in a minute.');
    }

    const body = await request.json().catch(() => null);
    const validation = riderDevicePermissionsSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }
    const { permissions } = validation.data;

    // 2026-09-08 device-tracking audit P1-2: the 9-key alias mapping was
    // copy-pasted into both permissions routes — now shared
    // (mapDevicePermissions) so the two surfaces cannot drift.
    const dbPermissions = mapDevicePermissions(permissions);

    if (Object.keys(dbPermissions).length === 0) {
      return errors.badRequest('No recognized permission keys in payload');
    }

    await deviceComplianceUseCases.syncState(riderDbId, dbPermissions);

    return success({ success: true }, 'Permissions synced successfully');
  } catch (err) {
    logger.error('[POST /api/rider/device/permissions]', err);
    return errors.internal('Failed to sync permissions');
  }
}
