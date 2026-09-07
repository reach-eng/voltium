/**
 * GET  /api/rider/profile — Get rider profile with all relations
 * PUT  /api/rider/profile — Update rider profile (core, KYC, guarantor fields)
 *
 * Thin route handlers: auth + parse + call use-case + respond.
 * Business logic lives in riderUseCases (profile update, field-level security).
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, updateProfileSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { riderUseCases } from '@/server/modules/riders/rider.use-cases';
import { RiderLifecycleError } from '@/server/modules/riders/rider-lifecycle.service';
import { RiderValidationError } from '@/server/modules/riders/rider-lifecycle.service';
import { toRupeesResponse } from '@/lib/api-money';
import { checkRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const PROFILE_RATE_LIMIT = { windowMs: 60_000, maxRequests: 60 };

async function checkProfileRateLimit(riderDbId: string) {
  // P1: the live app polls profile every 30–60s and each call fans out
  // (cache + notifications + rewards + rent + flatten + vehicle). Cap
  // per rider; fail-open so reads survive a limiter outage.
  const rl = await checkRateLimit(`rider:profile:${riderDbId}`, PROFILE_RATE_LIMIT);
  if (!rl.allowed) {
    return errors.tooManyRequests('Too many requests. Please try again later.', {
      rateLimit: { limit: PROFILE_RATE_LIMIT.maxRequests, remaining: rl.remaining, resetAt: rl.resetAt },
    });
  }
  return null;
}

// GET /api/rider/profile
export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const limited = await checkProfileRateLimit(riderDbId);
    if (limited) return limited;

    const rider = await riderUseCases.getProfile(riderDbId);
    if (!rider) return errors.notFound('Rider not found');

    return success(toRupeesResponse(rider), 'Profile fetched');
  } catch (err) {
    logger.error('[GET /api/rider/profile]', err);
    return errors.internal('Failed to fetch profile');
  }
}

// PUT /api/rider/profile — Update rider profile (core, KYC, or guarantor fields)
export async function PUT(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const limited = await checkProfileRateLimit(riderDbId);
    if (limited) return limited;

    const body = await request.json();
    const validation = validateBody(updateProfileSchema, body);
    if (!validation.success) {
      return errors.validation(validation.error);
    }

    const { riderId: bodyRiderId, ...updateData } = validation.data;
    if (bodyRiderId && riderDbId !== bodyRiderId) {
      return errors.forbidden("Cannot update another rider's profile");
    }

    const result = await riderUseCases.updateProfile(riderDbId, updateData);
    return success(toRupeesResponse(result), 'Profile updated');
  } catch (err) {
    if (err instanceof RiderLifecycleError) return errors.conflict((err instanceof Error ? err.message : String(err)));
    // EDIT-PROFILE-AUDIT P0-4 (2026-09-08): user-correctable
    // validation (DOB format/age, emergency contact = self,
    // guarantor self-phone, receipt missing/invalid, guarantor
    // required fields) now throws `RiderValidationError`
    // instead of plain `Error`. The route maps it to 409 with
    // the actual message so the client can render it; the
    // catch-all 500 is reserved for genuine server faults.
    if (err instanceof RiderValidationError) return errors.conflict(err.message);
    logger.error('[PUT /api/rider/profile]', err);
    return errors.internal('Failed to update profile');
  }
}
