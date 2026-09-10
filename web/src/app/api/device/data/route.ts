import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  deviceComplianceUseCases,
  DeviceConsentError,
} from '@/server/modules/device-compliance/device-compliance.use-cases';
import { logger } from '@/lib/logger';
import { isDeviceSeedAllowed } from '@/lib/device-policy';

// P1-4 (device-tracking audit, 2026-09-08): Zod envelope check.
// This route uses lowercase `type` values (`'location'`,
// `'contacts'`, `'call_logs'`) — different from
// /api/rider/sync/device-data which uses uppercase. The enum
// is the source of truth for what the use-case accepts.
const deviceDataSchema = z
  .object({
    type: z.enum(['location', 'contacts', 'call_logs']),
    data: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
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

    // P1-4: rider-scoped rate limit (5/min/rider, matches
    // set/verify-lock + the new sync route). The audit
    // specifically called out "nothing bounds call frequency".
    const rl = await checkRateLimit(`device-data:${riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many sync requests. Try again in a minute.');
    }

    const body = await request.json().catch(() => null);
    const validation = deviceDataSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }
    const { type, data } = validation.data;

    if (type === 'location') {
      // Zod envelope checked `type` and that `data` is either an
      // object or an array. Per-field shape validation lives in
      // the use-case (it caps fields + handles truncation). Cast
      // through `unknown` so the per-branch type matches.
      await deviceComplianceUseCases.syncLocation(riderDbId, data as Parameters<typeof deviceComplianceUseCases.syncLocation>[1]);
    } else if (type === 'contacts') {
      if (Array.isArray(data)) {
        await deviceComplianceUseCases.syncContacts(riderDbId, data as Array<{ name: string; phone: string; email?: string }>);
      }
    } else if (type === 'call_logs') {
      if (Array.isArray(data)) {
        await deviceComplianceUseCases.syncCallLogs(riderDbId, data as Array<{ number: string; name?: string; type?: string; duration?: number; timestamp: string }>);
      }
    }

    return success({ success: true }, 'Device data synced successfully');
  } catch (err) {
    // P1-1: explicit consent denial → 403 naming the consent type (mirrors
    // /api/rider/sync/device-data).
    if (err instanceof DeviceConsentError) {
      return errors.forbidden(
        `Ingestion blocked: consent for ${err.consentType} was denied`,
        { details: { consentType: err.consentType } }
      );
    }
    logger.error('[POST /api/device/data]', err);
    return errors.internal('Failed to sync device data');
  }
}
