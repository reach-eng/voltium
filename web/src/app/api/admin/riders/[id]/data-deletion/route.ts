import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/permissions';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { encryptPii } from '@/lib/pii-crypto';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { z } from 'zod';
import { randomBytes, createHash } from 'crypto';
import type { Prisma } from '@prisma/client';

// Approval token TTL: 1 hour. After this, the approver must re-issue.
const APPROVAL_TTL_MS = 60 * 60 * 1000;

// DELETE handler schema: requires the approval token issued by the approve endpoint.
const deleteSchema = z.object({
  approvalToken: z.string().min(32, 'Invalid approval token'),
});

/**
 * DELETE /api/admin/riders/[id]/data-deletion
 *
 * Two-person rule: requires a valid approval token from POST .../approve.
 * Soft-delete grace: sets `deletedAt` instead of immediate destruction. The
 * scheduled cleanup job (or any subsequent DELETE attempt) performs the actual
 * anonymization after 7 days. To restore, call POST .../restore within 7 days.
 *
 * The new permission keys `riders_delete_request` and `riders_delete_approve`
 * are separate from the legacy `riders_delete` key. The legacy key still works
 * for backward compatibility but routes through the same two-step flow.
 */
export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // Accept either the legacy `riders_delete` OR the new `riders_delete_request` permission.
  if (
    !hasPermission(session, 'riders_delete') &&
    !hasPermission(session, 'riders_delete_request')
  ) {
    return adminForbidden();
  }

  const { id: riderId } = await context.params;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }

  // Backward compatibility: if no body is provided AND the legacy `riders_delete`
  // permission is held, allow immediate (legacy) destruction. This preserves the
  // pre-two-person behavior for any caller that hasn't been updated.
  const isLegacyPath =
    !rawBody || Object.keys(rawBody as object).length === 0;
  if (isLegacyPath && hasPermission(session, 'riders_delete')) {
    logger.warn(
      '[DELETE /api/admin/riders/[id]/data-deletion] Legacy immediate-deletion path used; consider migrating to two-person flow',
      { adminId: session.adminId }
    );
  } else {
    // Two-person path: validate the approval token.
    const validation = deleteSchema.safeParse(rawBody);
    if (!validation.success) {
      return errors.badRequest(
        'Two-person rule: data deletion requires an approvalToken from POST .../approve. ' +
          'Admins with only `riders_delete` may omit the token for legacy immediate deletion.'
      );
    }
    const { approvalToken } = validation.data;
    const tokenValid = await consumeApprovalToken(riderId, approvalToken, session);
    if (!tokenValid) {
      return errors.forbidden(
        'Invalid or expired approval token. Request a new one from POST .../approve.'
      );
    }
  }

  const rider = await db.rider.findUnique({
    where: { id: riderId },
    include: {
      kycProfile: true,
      wallet: true,
      leases: { where: { status: 'ACTIVE' } },
    },
  });

  if (!rider) {
    return errors.notFound('Rider not found');
  }
  if (rider.leases.length > 0) {
    return errors.badRequest('Cannot delete rider with an active rental');
  }

  // If already soft-deleted within 7 days, do the actual destruction now.
  // If soft-deleted > 7 days ago, refuse (window closed).
  if (rider.deletedAt) {
    const daysSince = (Date.now() - rider.deletedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince > 7) {
      return errors.gone(
        `Data deletion window expired (${Math.floor(daysSince)} days since soft-delete). ` +
          'The 7-day recovery window has closed.'
      );
    }
  }

  // Audit log BEFORE the transaction. Compliance: any attempt is recorded.
  const actorId = session.adminId || session.riderDbId || 'unknown';
  try {
    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'rider.data_deletion_executed',
      entity: 'rider',
      entityId: riderId,
      details: JSON.stringify({
        adminRole: session.adminRole,
        riderLifecycleStatusBefore: rider.lifecycleStatus,
        hadKycProfile: Boolean(rider.kycProfile),
        hadActiveLease: rider.leases.length > 0,
        twoPersonPath: !isLegacyPath || !hasPermission(session, 'riders_delete'),
      }),
    });
  } catch (auditErr) {
    logger.error('[DELETE /api/admin/riders/[id]/data-deletion] Audit log write failed', auditErr);
    return errors.internal('Audit log write failed; data deletion aborted for compliance');
  }

  try {
    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // First-time: set deletedAt. Subsequent (within 7 days): proceed to anonymize.
      if (!rider.deletedAt) {
        await tx.rider.update({
          where: { id: riderId },
          data: { deletedAt: new Date() },
        });
        return; // Soft-delete done; actual anonymization is a scheduled job.
      }

      // Within 7-day window: do the actual anonymization.
      const randomSuffix = Math.floor(Math.random() * 1000000).toString();
      const anonymizedPhone = encryptPii(`DELETED-${randomSuffix}`) ?? `DELETED-${randomSuffix}`;
      const anonymizedEmail =
        encryptPii(`deleted-${randomSuffix}@voltium.app`) ?? `deleted-${randomSuffix}@voltium.app`;

      await tx.rider.update({
        where: { id: riderId },
        data: {
          phone: anonymizedPhone,
          email: anonymizedEmail,
          fullName: 'Deleted User',
          fcmToken: null,
          lifecycleStatus: 'CLOSED',
          deletedAt: new Date(), // keep set so /restore rejects after window
        },
      });

      if (rider.kycProfile) {
        await tx.kycProfile.update({
          where: { riderId: riderId },
          data: {
            aadhaarNumber: encryptPii(`DELETED-${randomSuffix}`),
            panNumber: encryptPii(`DELETED-${randomSuffix}`),
            accountNumber: encryptPii(`DELETED-${randomSuffix}`),
            ifscCode: encryptPii(`DELETED-${randomSuffix}`),
            profilePhoto: null,
            riderPhoto: null,
            signature: null,
            aadhaarFront: null,
            aadhaarBack: null,
            panCard: null,
            status: 'REJECTED',
            rejectionReason: 'Data deleted upon request',
          },
        });
      }

      await tx.deviceViolation.deleteMany({ where: { riderId: riderId } });
      await tx.userCallLog.deleteMany({ where: { riderId: riderId } });
      await tx.userContact.deleteMany({ where: { riderId: riderId } });
      await tx.userLocation.deleteMany({ where: { riderId: riderId } });
    });

    return success({
      message: rider.deletedAt
        ? 'Rider data successfully anonymized/deleted.'
        : 'Rider soft-deleted. Data will be permanently anonymized in 7 days unless restored.',
      softDeleted: !rider.deletedAt,
      recoveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  } catch (error) {
    console.error('Data deletion failed:', error);
    return errors.internal('Failed to delete rider data');
  }
}

// ---------------------------------------------------------------------------
// Approval token store (SystemSetting key per rider, value is hash + approverId + expiresAt)
// ---------------------------------------------------------------------------

const APPROVAL_KEY_PREFIX = 'rider.deletetoken.';

interface ApprovalTokenRecord {
  tokenHash: string; // SHA-256 of the issued token
  approverAdminId: string;
  expiresAt: number; // ms since epoch
  requesterAdminId?: string; // optional, set on consume
}

async function issueApprovalToken(
  riderId: string,
  approverAdminId: string
): Promise<{ token: string; expiresAt: number }> {
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = Date.now() + APPROVAL_TTL_MS;
  const record: ApprovalTokenRecord = { tokenHash, approverAdminId, expiresAt };

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
  return { token, expiresAt };
}

async function consumeApprovalToken(
  riderId: string,
  token: string,
  executorSession: { adminId?: string; riderDbId?: string }
): Promise<boolean> {
  const setting = await db.systemSetting.findUnique({
    where: { key: `${APPROVAL_KEY_PREFIX}${riderId}` },
  });
  if (!setting) return false;
  let record: ApprovalTokenRecord;
  try {
    record = JSON.parse(setting.value);
  } catch {
    return false;
  }
  if (record.expiresAt < Date.now()) return false;
  const presentedHash = createHash('sha256').update(token).digest('hex');
  // Timing-safe compare.
  const a = Buffer.from(presentedHash, 'hex');
  const b = Buffer.from(record.tokenHash, 'hex');
  if (a.length !== b.length) return false;
  // Use crypto.timingSafeEqual (Node built-in).
  const { timingSafeEqual } = require('crypto') as typeof import('crypto');
  if (!timingSafeEqual(a, b)) return false;
  // Two-person enforcement: the executor's adminId must differ from the approver's.
  const executorId = executorSession.adminId || executorSession.riderDbId || '';
  if (executorId && executorId === record.approverAdminId) {
    return false; // same person cannot approve AND execute
  }
  // Record the executor for audit and consume (delete the token so it's one-time).
  record.requesterAdminId = executorId;
  await db.systemSetting.delete({ where: { key: `${APPROVAL_KEY_PREFIX}${riderId}` } }).catch(() => {});
  return true;
}
