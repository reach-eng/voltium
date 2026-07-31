import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { randomBytes, createHash } from 'crypto';

const APPROVAL_TTL_MS = 60 * 60 * 1000;

const APPROVAL_KEY_PREFIX = 'rider.deletetoken.';

interface ApprovalTokenRecord {
  tokenHash: string;
  approverAdminId: string;
  expiresAt: number;
}

/**
 * POST /api/admin/riders/[id]/data-deletion/approve
 *
 * Approves a pending data-deletion request. Returns a one-time approval token
 * (1-hour TTL) that the requester must pass to the DELETE endpoint. The DELETE
 * executor must be a different admin from the approver (two-person rule).
 *
 * Requires the `riders_delete_approve` permission. The `SUPER_ADMIN` role is
 * required for a real second approver (a separate person, not just a different
 * admin role).
 */
export async function POST(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'riders_delete_approve')) {
    return adminForbidden();
  }

  const { id: riderId } = await context.params;

  const rider = await db.rider.findUnique({ where: { id: riderId } });
  if (!rider) return errors.notFound('Rider not found');

  // Issue the token.
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + APPROVAL_TTL_MS;
  const record: ApprovalTokenRecord = {
    tokenHash,
    approverAdminId: session.adminId || session.riderDbId || 'unknown',
    expiresAt,
  };

  await db.systemSetting.upsert({
    where: { key: `${APPROVAL_KEY_PREFIX}${riderId}` },
    update: { value: JSON.stringify(record) },
    create: {
      key: `${APPROVAL_KEY_PREFIX}${riderId}`,
      value: JSON.stringify(record),
      valueType: 'STRING',
      category: 'INTERNAL',
      isSecret: true,
      isEditable: false,
    },
  });

  // Audit log the approval.
  const actorId = session.adminId || session.riderDbId || 'unknown';
  try {
    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'rider.data_deletion_approved',
      entity: 'rider',
      entityId: riderId,
      details: JSON.stringify({
        approverAdminRole: session.adminRole,
        tokenExpiresAt: new Date(expiresAt).toISOString(),
      }),
    });
  } catch (auditErr) {
    logger.error(
      '[POST /api/admin/riders/[id]/data-deletion/approve] Audit log write failed',
      auditErr
    );
    // Don't fail the approval — the audit is best-effort for approvals.
  }

  return success({
    approvalToken: token,
    expiresAt: new Date(expiresAt).toISOString(),
    riderId,
  });
}
