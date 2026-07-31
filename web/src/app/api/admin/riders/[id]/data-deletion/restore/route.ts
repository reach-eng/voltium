import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

/**
 * POST /api/admin/riders/[id]/data-deletion/restore
 *
 * Restores a soft-deleted rider within the 7-day recovery window. After 7 days,
 * the rider data is permanently anonymized and recovery is no longer possible.
 *
 * Requires the `riders_delete_recover` permission.
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'riders_delete_recover')) {
    return adminForbidden();
  }

  const { id: riderId } = await context.params;

  const rider = await db.rider.findUnique({ where: { id: riderId } });
  if (!rider) return errors.notFound('Rider not found');

  if (!rider.deletedAt) {
    return errors.badRequest('Rider is not soft-deleted; no restoration needed.');
  }

  const daysSince = (Date.now() - rider.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSince > 7) {
    return errors.gone(
      `Recovery window expired (${Math.floor(daysSince)} days since soft-delete). ` +
        'The 7-day recovery window has closed.'
    );
  }

  await db.rider.update({
    where: { id: riderId },
    data: { deletedAt: null, lifecycleStatus: 'ACTIVE' },
  });

  // Audit log the restore.
  const actorId = session.adminId || session.riderDbId || 'unknown';
  try {
    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'rider.data_deletion_restored',
      entity: 'rider',
      entityId: riderId,
      details: JSON.stringify({
        daysSinceSoftDelete: Math.floor(daysSince),
        approverAdminRole: session.adminRole,
      }),
    });
  } catch (auditErr) {
    logger.error(
      '[POST /api/admin/riders/[id]/data-deletion/restore] Audit log write failed',
      auditErr
    );
    // Don't fail the restore — the audit is best-effort.
  }

  return success({
    message: 'Rider restored. The soft-delete window has been reset to 7 days.',
    recoveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  });
}
