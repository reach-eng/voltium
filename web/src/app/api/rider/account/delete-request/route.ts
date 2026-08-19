import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';
import { createAuditLog } from '@/lib/audit-log';
import { db } from '@/lib/db';
import { z } from 'zod';

// PR-3 (2026-08-07 verification report, Section 2 — Flutter Profile P0-2):
// rider-initiated GDPR/DPDP deletion request. The settings screen used to
// POST `{action: 'DELETE_REQUEST'}` to /api/rider/profile, which had no
// handler — the request was silently dropped while the app showed a success
// snackbar. This route records the request in the audit log (the same source
// of truth the admin data-deletion flow reads), so operators can see the
// pending request and act on it via the two-person-rule admin flow.
const deleteRequestSchema = z.object({
  reason: z.string().max(500).optional(),
  timestamp: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof Response) return auth;

    const body = await req.json();
    const validation = deleteRequestSchema.safeParse(body);
    if (!validation.success) {
      return errors.badRequest('Invalid deletion request payload');
    }

    const { reason } = validation.data;

    // Mark the request on the rider row so read paths can surface a
    // "deletion pending" state without relying on audit-log lookups.
    await db.rider.update({
      where: { id: auth.riderDbId },
      data: { deletionRequestedAt: new Date(), deletionRequestReason: reason ?? null },
    });

    await createAuditLog({
      actorId: auth.riderDbId,
      actorType: 'RIDER',
      action: 'RIDER_DELETION_REQUESTED',
      entity: 'Rider',
      entityId: auth.riderDbId,
      details: { reason: reason ?? 'No reason provided' },
    });

    logger.info('[DeleteRequest] Rider requested account deletion', {
      riderId: auth.riderDbId,
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
