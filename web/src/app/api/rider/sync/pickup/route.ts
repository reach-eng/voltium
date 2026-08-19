/**
 * POST /api/rider/sync/pickup — Complete vehicle pickup
 *
 * Thin route handler: auth + parse + call use-case + respond.
 *
 * PR-26b: routes the request through the new
 * `completePickupVerification` use case (with precondition checks + audit
 * log) instead of calling `rentalUseCases.syncPickup` directly. The
 * use case delegates to syncPickup internally for the actual
 * vehicle-claim + state-transition work.
 */

import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { env } from '@/lib/env';
import { requireRiderSession } from '@/lib/rider-auth';
import { verifyVerifyReceipt } from '@/lib/verify-receipt';
import { db } from '@/lib/db';
import { completePickupVerification, PickupVerificationError } from '@/server/modules/pickup/use-cases';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const body = await request.json();
    const {
      vehicleId,
      hubId,
      teamLeader,
      emergencyContact,
      emergencyContactReceipt,
      pickupPhoto,
      pickupPhotoFront,
      pickupPhotoBack,
      pickupPhotoLeft,
      pickupPhotoRight,
      pickupPhotoWithVehicle,
      // PR-PICKUP-OTP: legacy client-asserted fields are deliberately NOT
      // trusted — a client claiming verifiedPhone/verifiedAt proves nothing
      // (anyone can write a timestamp). They are ignored; the signed
      // `emergencyContactReceipt` (issued by /api/auth/verify-phone) is the
      // only server-verifiable proof of OTP verification.
      verifiedPhone: _ignoredVerifiedPhone,
      verifiedAt: _ignoredVerifiedAt,
    } = body;

    if (!vehicleId) return errors.badRequest('Vehicle ID/Number is required');

    // PR-ONBOARDING-FLOW-2026-08-12: the rider client sends the team leader
    // by NAME (e.g. "Rajesh Kumar (TL-01)"), not by database id. The
    // pickup_hub form only stores the name string. Look up the matching
    // `TeamLeader.id` so the downstream `rider.teamLeaderId` foreign key
    // doesn't reject the write. If no match (legacy hardcoded list,
    // typo, or TL deactivated), pass `null` — the team-leader assignment
    // is informational, not blocking.
    let resolvedTeamLeaderId: string | null = null;
    if (teamLeader && typeof teamLeader === 'string' && teamLeader.trim().length > 0) {
      const trimmed = teamLeader.trim();
      // Fast path: the value already looks like a cuid (Flutter has both
      // the live endpoint and a legacy const; either may be in flight).
      const looksLikeCuid = /^c[a-z0-9]{20,30}$/i.test(trimmed);
      if (looksLikeCuid) {
        resolvedTeamLeaderId = trimmed;
      } else {
        const match = await db.teamLeader.findFirst({
          where: {
            deletedAt: null,
            isActive: true,
            name: trimmed,
          },
          select: { id: true },
        });
        if (match) {
          resolvedTeamLeaderId = match.id;
        } else {
          logger.warn(
            '[sync/pickup] teamLeader name did not resolve to an active TL id; leaving teamLeaderId unset',
            { teamLeader: trimmed }
          );
        }
      }
    }

    // PR-PICKUP-OTP: server-side emergency-contact gate. When an emergency
    // contact is supplied:
    //   - a receipt, if present, MUST be valid for that exact number
    //     (signature + 15-min TTL + phone match) — otherwise 400.
    //   - a missing receipt is accepted for backward compatibility UNLESS
    //     REQUIRE_EMERGENCY_CONTACT_RECEIPT=true, in which case the
    //     submission is rejected so the gate is server-enforced.
    const cleanEmergencyContact = emergencyContact
      ? String(emergencyContact).replace(/\D/g, '')
      : '';
    if (cleanEmergencyContact) {
      if (emergencyContactReceipt) {
        const receiptCheck = verifyVerifyReceipt(
          String(emergencyContactReceipt),
          cleanEmergencyContact
        );
        if (!receiptCheck.valid) {
          return errors.badRequest(
            `Emergency contact verification receipt is invalid: ${receiptCheck.reason}`
          );
        }
      } else if (env.REQUIRE_EMERGENCY_CONTACT_RECEIPT) {
        return errors.badRequest(
          'Emergency contact verification receipt is required'
        );
      }
    }

    const result = await completePickupVerification(riderDbId, {
      vehicleId,
      hubId,
      teamLeaderId: resolvedTeamLeaderId ?? undefined,
      emergencyContact: cleanEmergencyContact,
      pickupPhotoFront: pickupPhotoFront || pickupPhoto,
      pickupPhotoBack,
      pickupPhotoLeft,
      pickupPhotoRight,
      pickupPhotoWithVehicle,
    });

    logger.info('Vehicle pickup completed', { riderId: riderDbId, vehicleId });
    return success(result, 'Vehicle pickup successful and account activated');
  } catch (err) {
    if (err instanceof PickupVerificationError) {
      switch (err.code) {
        case 'PHOTOS_REQUIRED':
        case 'INVALID_STATE':
        case 'RIDER_NOT_FOUND':
          return errors.badRequest(err.message);
        default:
          return errors.badRequest(err.message);
      }
    }
    if (err instanceof Error && err.message.includes('not found')) {
      return errors.notFound(err.message);
    }
    if (err instanceof Error && err.message.includes('currently')) {
      return errors.conflict(err.message);
    }
    logger.error('Failed to complete vehicle pickup', err);
    return errors.internal('Failed to complete pickup');
  }
}
