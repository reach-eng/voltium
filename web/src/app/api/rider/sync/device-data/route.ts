import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  deviceComplianceUseCases,
  DeviceConsentError,
} from '@/server/modules/device-compliance/device-compliance.use-cases';

// P1-4 (device-tracking audit, 2026-09-08): Zod envelope check.
// The previous code accepted `{ type, data }` as `any` from
// `request.json()`. The per-call caps in the use-case (1000
// contacts / 5000 logs) handled payload bloat, but a malformed
// JSON shape flowed straight into the use-case. The schema
// enforces the type/shape pairing: CONTACTS and CALL_LOGS expect
// an array, LOCATION expects an object. Per-field shape stays in
// the use-case (per-field caps + truncation).
const syncDeviceDataSchema = z
  .object({
    type: z.enum(['CONTACTS', 'CALL_LOGS', 'LOCATION']),
    data: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
  })
  .strict();

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    // P1-4: rider-scoped rate limit. The lock + verify-lock routes
    // use 5/min/rider; we match. Per the audit, this surface had
    // NO rate limit (just per-call caps), so a compromised token
    // turned `createMany` into a write hose. 5/min is well above
    // the normal ~1/min sync cadence but blocks a token-leak script.
    const rl = await checkRateLimit(`rider-sync-device-data:${riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 5,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many sync requests. Try again in a minute.');
    }

    const body = await request.json().catch(() => null);
    const validation = syncDeviceDataSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }
    const { type, data } = validation.data;

    switch (type) {
      case 'CONTACTS':
        if (Array.isArray(data)) {
          await deviceComplianceUseCases.syncContacts(
            riderDbId,
            data as Array<{ name: string; phone: string; email?: string }>
          );
        }
        return success(null, 'Contacts synced');

      case 'CALL_LOGS':
        if (Array.isArray(data)) {
          await deviceComplianceUseCases.syncCallLogs(
            riderDbId,
            data as Array<{ number: string; name?: string; type?: string; duration?: number; timestamp: string }>
          );
        }
        return success(null, 'Call logs synced');

      case 'LOCATION':
        await deviceComplianceUseCases.syncLocation(
          riderDbId,
          data as Parameters<typeof deviceComplianceUseCases.syncLocation>[1]
        );
        return success(null, 'Location updated');
    }
  } catch (err) {
    // 2026-09-08 device-tracking audit P1-1: an explicit consent denial is
    // a policy decision, not a server fault — map it to 403 naming the
    // consent type so the client can surface "you denied contacts" instead
    // of a generic 500.
    if (err instanceof DeviceConsentError) {
      return errors.forbidden(
        `Ingestion blocked: consent for ${err.consentType} was denied`,
        { details: { consentType: err.consentType } }
      );
    }
    logger.error('[POST /api/rider/sync/device-data]', err);
    return errors.internal('Failed to sync device data');
  }
}
