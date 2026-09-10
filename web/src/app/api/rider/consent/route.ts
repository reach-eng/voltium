import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireRiderSession } from '@/lib/rider-auth';
import { logger } from '@/lib/logger';
import { validateBody, consentSchema } from '@/lib/validators';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
// P1-3 (device-tracking audit, 2026-09-08): when a rider re-grants
// a permission (POST with `granted: true`), close any open
// ACTIVE device-violation row for that permission and decrement
// the counter. The 7-day auto-resolver covers the case where
// the rider never re-grants; this path covers the immediate case.
import { deviceComplianceUseCases } from '@/server/modules/device-compliance/device-compliance.use-cases';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;

    // LEGAL-AUDIT-P1-4-2026-09-08: per-rider rate limit. Without
    // this, a loop spams unboundedly — every tap appends a Consent
    // row, history silently truncates at the GET `take: 100`. The
    // rider's _handleContinue POSTs 6 legal types in a single tap.
    // SPLASH-AUDIT-P0-2-2026-09-10: the app now also replays the full
    // device grant state (up to 15 consent types) right after OTP
    // verification via syncAllConsents(), so the natural ceiling per
    // minute is ~21 (1 wall accept + 1 full replay + a retry). Set 25
    // to leave headroom without letting a script run wild. Mirrors the
    // shape used by web/src/app/api/transaction/topup/route.ts:28
    // (per-rider `rider:xxx:${riderDbId}`).
    const rl = await checkRateLimit(`rider:consent:${auth.riderDbId}`, {
      windowMs: 60_000,
      maxRequests: 25,
    });
    if (!rl.allowed) {
      return errors.tooManyRequests('Too many consent submissions. Please try again later.');
    }

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

    // P1-2 (2026-09-08 legal audit): legal-document acceptance rows are
    // SERVER-recorded (the acceptance happened against server-rendered
    // content), everything else stays DEVICE.
    const LEGAL_CONSENT_TYPES = new Set([
      'TERMS',
      'PRIVACY',
      'RENTAL_SAFETY',
      'REFUND',
      'GUARANTOR',
      'LEASE',
    ]);
    const source = LEGAL_CONSENT_TYPES.has(consentType) ? 'SERVER' : 'DEVICE';

    // DPDP Act 2023 §6 + §8: persist consent audit trail to DB.
    // Previously this endpoint only logged (P0-2 fix).
    const consent = await db.consent.create({
      data: {
        riderId: auth.riderDbId,
        consentType,
        granted,
        policyVersion: policyVersion ?? 'public-beta-v1',
        source,
      },
    });

    // P1-3 (device-tracking audit, 2026-09-08): resolve-on-grant.
    // If the rider re-grants a permission that had an open
    // ACTIVE violation (LOCATION / CONTACTS / CALL_LOGS — the
    // three permissionIds the violation table knows), close the
    // row and decrement the counter. For other consentType
    // values (CAMERA / PHONE / MIC / ... and the legal-document
    // types) the use-case is a no-op: 0 rows updated, no
    // counter change.
    if (granted) {
      const resolved = await deviceComplianceUseCases.resolveViolationOnGrant(
        auth.riderDbId,
        consentType
      );
      if (resolved > 0) {
        logger.info('[POST /api/rider/consent] Resolved device violation on grant', {
          riderId: auth.riderDbId,
          consentType,
          rowsResolved: resolved,
        });
      }
    }

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
