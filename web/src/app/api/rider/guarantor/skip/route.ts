/**
 * POST /api/rider/guarantor/skip — record that the rider opts to skip the
 * guarantor step and pay the higher security deposit instead.
 *
 * P1 fix: the skip was previously client-only (a shared-prefs flag the
 * server never saw), so `Rider.requiresHigherDeposit` could never become
 * true and the F-03 surcharge was dead — while any rider could clear the
 * flag via updateProfile. This endpoint is the server-authoritative write
 * path: set-true-only and idempotent. Only a real guarantor submission
 * clears the flag; `requiresHigherDeposit` is not rider-writable anywhere
 * else (see SAFE_RIDER_FIELDS / updateProfileSchema).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { getSkipGuarantorExtraDepositPaise } from '@/server/modules/plans/plan.use-cases';
import { paiseToRupees } from '@/lib/flatten-rider';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await requireRiderSession(request);
    if (session instanceof Response) return session;
    const riderDbId = session.riderDbId;

    // A rider with a live guarantor has nothing to skip.
    const guarantor = await db.guarantor.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });
    if (guarantor && (guarantor.status === 'APPROVED' || guarantor.status === 'SUBMITTED')) {
      return errors.conflict('A guarantor is already on file; skip is not applicable');
    }

    await db.rider.updateMany({
      where: { id: riderDbId, requiresHigherDeposit: false },
      data: { requiresHigherDeposit: true },
    });

    const extraPaise = await getSkipGuarantorExtraDepositPaise();
    return success(
      { requiresHigherDeposit: true, extraDepositRupees: paiseToRupees(extraPaise) },
      'Guarantor skipped — higher security deposit applies'
    );
  } catch (err) {
    logger.error('[POST /api/rider/guarantor/skip]', err);
    return errors.internal('Failed to record guarantor skip');
  }
}
