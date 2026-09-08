import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit-log';
import { validateBody } from '@/lib/validators';
import { dataDeletionRestoreSchema } from '@/lib/validators/admin';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import {
  validateTransition,
  RiderLifecycleError,
} from '@/server/modules/riders/rider-lifecycle.service';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission('riders_delete_approve');
  if (!session) {
    return errors.forbidden('Insufficient permissions to restore data deletion');
  }

  const { id: riderId } = await context.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    body = {};
  }

  const parsed = validateBody(dataDeletionRestoreSchema, body);
  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  try {
    const rider = await db.rider.findUnique({
      where: { id: riderId }
    });

    if (!rider) {
      return errors.notFound('Rider not found');
    }

    if (rider.lifecycleStatus !== 'CLOSED') {
      return errors.badRequest('Rider is not in soft-deleted state');
    }

    // PR-2026-08-16: once data-deletion-purge.job.ts destroyed the PII
    // (purgedAt set), the rider cannot be meaningfully restored — the phone
    // is a sentinel and every PII field is null. Reject so the API matches
    // the queue UI, which hides Restore for purged rows.
    if (rider.purgedAt) {
      return errors.badRequest(
        'Rider has been permanently purged and cannot be restored'
      );
    }

    // PR-7 (2026-08-06 fix-plan; 1st audit P0-1): the DELETE route sets
    // `deletedAt: new Date()`, and the db soft-delete middleware filters
    // `deletedAt: null` on every Rider find — so restoring the lifecycle
    // WITHOUT clearing deletedAt left the rider permanently invisible to
    // every list/get. Clear it here.
    //
    // NET-005 follow-up-19 (2026-09-08): the pre-fix
    // code wrote `lifecycleStatus: 'ACTIVE'` directly
    // with no state-machine check. ACTIVE was only
    // reachable from PICKUP_SCHEDULED in the machine,
    // and the restore was for a CLOSED rider. Add
    // the CLOSED → ACTIVE transition (rider-lifecycle
    // .service.ts:CLOSED) and validate explicitly so
    // the route 409s if a non-CLOSED rider is somehow
    // restored (e.g. lifecycle drift after a future
    // schema migration). The `lifecycleStatus !==
    // 'CLOSED'` check above is the user-facing
    // short-circuit (returns 400 "not in soft-deleted
    // state"); the state-machine call is
    // defense-in-depth.
    validateTransition(
      rider.lifecycleStatus as Parameters<typeof validateTransition>[0],
      'ACTIVE'
    );
    await db.rider.update({
      where: { id: riderId },
      data: {
        lifecycleStatus: 'ACTIVE',
        deletedAt: null,
      }
    });

    const actorId = session.adminId ?? session.riderDbId ?? 'system';

    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'rider.data_deletion.restored',
      entity: 'Rider',
      entityId: riderId,
      details: {
        reason: parsed.data?.reason,
        requestId: parsed.data?.requestId,
      },
    });

    return success({
      message: 'Rider restored successfully',
    });
  } catch (error) {
    // NET-005 follow-up-19 (2026-09-08): the
    // state-machine validation throws
    // RiderLifecycleError. Map to 409 so the client
    // gets the right status code; everything else
    // falls through to 500. The restore route is a
    // thin route handler (not wrapped in
    // withApiHandler), so the api-handler's canonical
    // 409 mapping at api-handler.ts:83-90 doesn't
    // apply — we have to do the mapping here.
    if (error instanceof RiderLifecycleError) {
      logger.info('Data deletion restore rejected by state machine', {
        riderId,
        error: error.message,
      });
      return errors.conflict(error.message);
    }
    logger.error('Data deletion restore failed:', error);
    return errors.internal('Failed to restore data deletion');
  }
}
