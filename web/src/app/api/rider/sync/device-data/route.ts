import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { requireRiderSession } from '@/lib/rider-auth';
import {
  deviceComplianceUseCases,
  SyncQuotaError,
  SyncValidationError,
} from '@/server/modules/device-compliance/device-compliance.use-cases';

// W10 / I-6: the route previously destructured `body` raw — a malformed
// payload (`data: "x"`, garbage timestamps) threw deep inside the use-cases
// and surfaced as 500s, and nothing bounded how much PII a single rider
// could accumulate. Payloads are now schema-validated here (shape + bounds),
// and volume is capped per-rider-per-hour inside the use-cases.

const contactsSyncSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().min(1).max(32),
  email: z.string().email().max(200).optional(),
});

const callLogsSyncSchema = z.object({
  number: z.string().min(1).max(32),
  name: z.string().max(200).optional(),
  type: z.string().max(20).optional(),
  duration: z.number().int().min(0).max(86_400).optional(),
  timestamp: z.coerce.date(),
});

const locationSyncSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  accuracy: z.number().nonnegative().optional(),
  speed: z.number().nonnegative().optional(),
  isMocked: z.boolean().optional(),
  batteryLevel: z.number().int().min(0).max(100).optional(),
});

const syncBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('CONTACTS'), data: z.array(contactsSyncSchema).min(1).max(1000) }),
  z.object({ type: z.literal('CALL_LOGS'), data: z.array(callLogsSyncSchema).min(1).max(5000) }),
  z.object({ type: z.literal('LOCATION'), data: locationSyncSchema }),
]);

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const parsed = syncBodySchema.safeParse(body);
    if (!parsed.success) {
      return errors.validation(
        parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
          .join('; ')
      );
    }

    switch (parsed.data.type) {
      case 'CONTACTS':
        await deviceComplianceUseCases.syncContacts(riderDbId, parsed.data.data);
        return success(null, 'Contacts synced');

      case 'CALL_LOGS':
        await deviceComplianceUseCases.syncCallLogs(riderDbId, parsed.data.data);
        return success(null, 'Call logs synced');

      case 'LOCATION':
        await deviceComplianceUseCases.syncLocation(riderDbId, parsed.data.data);
        return success(null, 'Location updated');
    }
  } catch (err) {
    // W10 / I-6: client faults get client-class responses, not 500s.
    if (err instanceof SyncQuotaError) {
      return errors.tooManyRequests(err.message);
    }
    if (err instanceof SyncValidationError) {
      return errors.badRequest(err.message);
    }
    logger.error('[POST /api/rider/sync/device-data]', err);
    return errors.internal('Failed to sync device data');
  }
}
