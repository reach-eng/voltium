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
    // with no state-machine check. Add the CLOSED →
    // ACTIVE transition (rider-lifecycle
    // .service.ts:CLOSED) and validate explicitly so
    // the route 409s if a non-CLOSED rider is somehow
    // restored.
    //
    // NET-005 follow-up-22 (2026-09-08): the
    // pre-fix code fabricated the post-restore
    // state — every rider came back as ACTIVE
    // regardless of source. A previously SUSPENDED
    // or RETURN_PENDING rider (or any future pre-
    // active state we add to the soft-delete
    // source set) would come back wrong. Read the
    // most recent
    // `rider.data_deletion.initiated` audit log
    // for this rider to recover the pre-deletion
    // state. The capture happens in the execute
    // route (`data-deletion/route.ts:previousLifecycleStatus`).
    // Fallback (no audit row found): 500 — we
    // can't fabricate the state; the right answer
    // is to fail loud so the operator investigates.
    const initiatedLog = await db.auditLog.findFirst({
      where: {
        action: 'rider.data_deletion.initiated',
        entityId: riderId,
      },
      orderBy: { createdAt: 'desc' },
    });
    if (!initiatedLog) {
      logger.error(
        'Restore cannot find the rider.data_deletion.initiated audit row; refusing to fabricate state',
        { riderId }
      );
      return errors.internal(
        'Cannot restore: no soft-delete audit row found for this rider. ' +
          'Investigate the rider history and contact engineering.'
      );
    }
    const initiatedDetails =
      typeof initiatedLog.details === 'string'
        ? JSON.parse(initiatedLog.details)
        : (initiatedLog.details as Record<string, unknown> | null) ?? {};
    const previousLifecycleStatus = initiatedDetails.previousLifecycleStatus as
      | string
      | undefined;
    if (!previousLifecycleStatus) {
      // Audit row exists but the pre-fix execute
      // route didn't capture the pre-deletion
      // state. Refuse rather than guess.
      logger.error(
        'Restore audit row exists but previousLifecycleStatus is missing; refusing to fabricate state',
        { riderId, auditId: initiatedLog.id }
      );
      return errors.internal(
        'Cannot restore: the pre-deletion state was not captured. ' +
          'Investigate the audit row and contact engineering.'
      );
    }
    validateTransition(
      rider.lifecycleStatus as Parameters<typeof validateTransition>[0],
      previousLifecycleStatus as Parameters<typeof validateTransition>[1]
    );
    await db.rider.update({
      where: { id: riderId },
      data: {
        lifecycleStatus:
          previousLifecycleStatus as Parameters<typeof validateTransition>[1],
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
        // NET-005 follow-up-22 (2026-09-08):
        // record the restored-to state so a
        // follow-up audit can verify the
        // pre-fix fabricated state is gone.
        restoredTo: previousLifecycleStatus,
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
