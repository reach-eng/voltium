import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  validateTransition,
  RiderLifecycleError,
} from '@/server/modules/riders/rider-lifecycle.service';

const deleteRequestSchema = z.object({
  approvalToken: z.string().min(1)
});

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  // NET-005 follow-up-18 (2026-09-08): the previous
  // permission key was the undeclared `admin:write` —
  // a key the role map didn't know about, so the
  // lookup at `permissions.ts:88-92` returned
  // `false`, leaving the SUPER_ADMIN blanket bypass
  // at line 75 as the only way through. Use the
  // real `riders_delete_execute` key so non-superadmin
  // roles with the permission (FINANCE_ADMIN) can
  // actually execute an approved deletion.
  const session = await requirePermission('riders_delete_execute');
  if (!session) {
    return errors.forbidden('Insufficient permissions to execute rider deletion (riders_delete_execute required)');
  }

  const { id: riderId } = await context.params;

  let body: unknown = {};
  try {
    body = await req.json();
  } catch (e) {
    // try to get from headers if not in body
    const token = req.headers.get('x-approval-token');
    if (token) {
      body = { approvalToken: token };
    }
  }

  const parsed = deleteRequestSchema.safeParse(body);
  let approvalToken = '';
  if (!parsed.success) {
    // check header fallback
    const token = req.headers.get('x-approval-token');
    if (!token) {
      return errors.badRequest('approvalToken is required in body or x-approval-token header');
    }
    approvalToken = token;
  } else {
    approvalToken = parsed.data.approvalToken;
  }


  // Find the approval audit log for this rider
  const approvalLog = await db.auditLog.findFirst({
    where: {
      action: 'RIDER_DATA_DELETION_APPROVED',
      entityId: riderId,
      expiresAt: {
        gt: new Date()
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  if (!approvalLog) {
    return errors.badRequest('No valid approval found for this rider');
  }

  // Parse details
  let details: Record<string, any> = {};
  if (typeof approvalLog.details === 'string') {
    try {
      details = JSON.parse(approvalLog.details);
    } catch (e) {}
  } else if (approvalLog.details && typeof approvalLog.details === 'object') {
    details = approvalLog.details;
  }

  if (details.approvalToken !== approvalToken) {
    return errors.badRequest('Invalid approval token');
  }

  const actorId = session.adminId ?? session.riderDbId ?? 'system';

  if (details.requestedBy === actorId || approvalLog.actorId === actorId) {
    return errors.forbidden('Executor cannot be the same as the requester or approver (Two-Person rule)');
  }

  const rider = await db.rider.findUnique({
    where: { id: riderId },
    include: {
      leases: {
        where: { status: 'ACTIVE' }
      }
    }
  });

  if (!rider) {
    return errors.notFound('Rider not found');
  }

  if (rider.leases.length > 0) {
    return errors.badRequest('Cannot delete rider with an active rental');
  }

  try {
    // NET-005 follow-up-19 (2026-09-08): the pre-fix
    // code wrote `lifecycleStatus: 'CLOSED'` directly
    // with no state-machine check. The transition
    // map only allows → CLOSED from
    // {ACTIVE, SUSPENDED, RETURN_PENDING} — a rider
    // already in CLOSED (double-soft-delete) and
    // a rider in any other state would silently
    // bypass the machine. Validate explicitly. The
    // legal source states for the GDPR soft-delete
    // are ACTIVE / SUSPENDED / RETURN_PENDING
    // (pre-active riders cannot have a GDPR
    // soft-delete: their PII is cleared by the
    // purge job, not the soft-delete path). If a
    // caller needs to soft-delete a pre-active
    // rider, that is a separate admin action (not
    // the GDPR flow).
    // (validateTransition is imported at the top
    // of this file now; the dynamic import was
    // removed in follow-up-19 because the
    // RiderLifecycleError instanceof check in the
    // catch block needs the static import.)
    validateTransition(rider.lifecycleStatus as Parameters<typeof validateTransition>[0], 'CLOSED');
    await db.$transaction(async (tx) => {
      await tx.rider.update({
        where: { id: riderId },
        data: {
          lifecycleStatus: 'CLOSED',
          deletedAt: new Date(),
          fcmToken: null
        }
      });

      // Clear active sessions
      await tx.deviceViolation.deleteMany({
        where: { riderId: riderId }
      });
      await tx.userCallLog.deleteMany({
        where: { riderId: riderId }
      });
      await tx.userContact.deleteMany({
        where: { riderId: riderId }
      });
      await tx.userLocation.deleteMany({
        where: { riderId: riderId }
      });
    });

    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'rider.data_deletion.initiated',
      entity: 'Rider',
      entityId: riderId,
      details: { approvalToken }
    });

    return success({
      message: 'Rider soft-deleted successfully.'
    });
  } catch (error) {
    // NET-005 follow-up-19 (2026-09-08): the
    // state-machine validation (CLOSED transition)
    // throws RiderLifecycleError. The api-handler's
    // canonical 409 mapping at api-handler.ts:83-90
    // doesn't apply because the data-deletion route
    // is a thin route handler (not wrapped in
    // withApiHandler). Re-throw / map the state
    // machine error to 409 here so the client gets
    // the right status code; everything else falls
    // through to 500.
    if (error instanceof RiderLifecycleError) {
      logger.info('Data deletion rejected by state machine', { riderId, error: error.message });
      return errors.conflict(error.message);
    }
    logger.error('Data deletion initiated failed:', error);

    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'rider.data_deletion.failed',
      entity: 'Rider',
      entityId: riderId,
      details: { error: error instanceof Error ? error.message : String(error) },
    }).catch(() => {});

    return errors.internal('Failed to initiate data deletion');
  }
}
