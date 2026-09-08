import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { createAuditLog } from '@/lib/audit-log';
import { db } from '@/lib/db';
import { checkRateLimit } from '@/lib/rate-limit';
import { z } from 'zod';

// PR-3 (2026-08-07 verification report, Section 2 — Flutter Profile P0-2):
// rider-initiated GDPR/DPDP deletion request. The settings screen used to
// POST `{action: 'DELETE_REQUEST'}` to /api/rider/profile, which had no
// handler — the request was silently dropped while the app showed a success
// snackbar. This route records the request in the audit log (the same source
// of truth the admin data-deletion flow reads), so operators can see the
// pending request and act on it via the two-person-rule admin flow.
//
// P0-2 hardening (settings audit, 2026-09-08):
//   - rate limit (3 requests/hour/rider): the marker write + audit row are
//     not free, and an attacker with a live session can spam the operator
//     queue; sibling rider POST endpoints all carry limits.
//   - `req.json()` is guarded — a bodyless/invalid POST now 400s instead of
//     falling into the catch-all 500.
//   - a missing rider row 404s instead of throwing Prisma P2025 → 500.
const deleteRequestSchema = z.object({
  reason: z.string().max(500).optional(),
  timestamp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const rateLimit = await checkRateLimit(`delete-request:${riderDbId}`, {
      windowMs: 60 * 60 * 1000,
      maxRequests: 3,
    });
    if (!rateLimit.allowed) {
      return errors.tooManyRequests(
        'Too many deletion requests. Please contact support.'
      );
    }

    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is acceptable (reason/timestamp are optional) — but
      // malformed JSON should be a 400, not a 500.
      body = {};
    }
    const validation = deleteRequestSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest('Invalid deletion request payload');
    }

    const { reason } = validation.data;

    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { id: true, deletionRequestedAt: true },
    });
    if (!rider) {
      return errors.notFound('Rider not found');
    }

    // Mark the request on the rider row so read paths can surface a
    // "deletion pending" state without relying on audit-log lookups.
    await db.rider.update({
      where: { id: riderDbId },
      data: { deletionRequestedAt: new Date(), deletionRequestReason: reason ?? null },
    });

    await createAuditLog({
      actorId: riderDbId,
      actorType: 'RIDER',
      action: 'rider.deletion_requested',
      entity: 'Rider',
      entityId: riderDbId,
      details: {
        reason: reason ?? 'No reason provided',
        // Repeat requests are visible to operators (the rider may be
        // escalating); the first timestamp is preserved on the row.
        repeatedRequest: rider.deletionRequestedAt != null,
      },
    });

    logger.info('[DeleteRequest] Rider requested account deletion', {
      riderId: riderDbId,
    });

    return success(
      null,
      'Deletion request recorded. An administrator will review and process it.'
    );
  } catch (error: unknown) {
    logger.error('[DeleteRequest] Failed to record deletion request:', error);
    return errors.internal('Failed to record deletion request');
  }
}
