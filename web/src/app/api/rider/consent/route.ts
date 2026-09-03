import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { logger } from '@/lib/logger';
import { validateBody, consentSchema } from '@/lib/validators';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

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

    const validation = validateBody(consentSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { consentType, granted, policyVersion } = validation.data;

    // DPDP Act 2023 §6 + §8: persist consent audit trail to DB.
    // Previously this endpoint only logged (P0-2 fix).
    const consent = await db.consent.create({
      data: {
        riderId: auth.riderDbId,
        consentType,
        granted,
        policyVersion: policyVersion ?? 'public-beta-v1',
        source: 'DEVICE',
      },
    });

    logger.info('[POST /api/rider/consent] Consent persisted', {
      id: consent.id,
      riderId: auth.riderDbId,
      consentType,
      granted,
      policyVersion,
    });

    return success(
      {
        id: consent.id,
        consentType,
        granted,
        policyVersion: consent.policyVersion,
        recordedAt: consent.createdAt.toISOString(),
      },
      'Consent recorded'
    );
  } catch (err) {
    logger.error('[POST /api/rider/consent]', err);
    return errors.internal('Failed to record consent');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    // P1: bound to the rider's own rows (small by construction, never unbounded).
    const consents = await db.consent.findMany({
      where: { riderId: auth.riderDbId },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        consentType: true,
        granted: true,
        policyVersion: true,
        source: true,
        createdAt: true,
      },
    });

    return success({ consents });
  } catch (err) {
    logger.error('[GET /api/rider/consent]', err);
    return errors.internal('Failed to fetch consent history');
  }
}
