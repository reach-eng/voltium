import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const consentSchema = z.object({
  consentType: z.enum(['LOCATION', 'CONTACTS', 'CALL_LOGS']),
  granted: z.boolean(),
  policyVersion: z.string().optional().default('public-beta-v1'),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errors.badRequest('Invalid request body');
    }

    const validation = consentSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.message);
    }

    const { consentType, granted, policyVersion } = validation.data;

    // Consent is stored locally on device; this endpoint acknowledges receipt.
    // A full consent audit table can be added later if needed.
    logger.info('[POST /api/rider/consent]', {
      riderId: auth.riderDbId,
      consentType,
      granted,
      policyVersion,
    });

    return success(
      { consentType, granted, policyVersion, recordedAt: new Date().toISOString() },
      'Consent recorded'
    );
  } catch (err) {
    logger.error('[POST /api/rider/consent]', err);
    return errors.internal('Failed to record consent');
  }
}
