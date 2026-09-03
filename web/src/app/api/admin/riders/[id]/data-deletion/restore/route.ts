import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit-log';
import { validateBody } from '@/lib/validators';
import { dataDeletionRestoreSchema } from '@/lib/validators/admin';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

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
    action: 'RIDER_DATA_DELETION_RESTORED',
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
}
