import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';

const deleteRequestSchema = z.object({
  approvalToken: z.string().min(1)
});

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission('admin:write');
  if (!session) {
    return errors.forbidden('Insufficient permissions to delete rider data');
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
      action: 'RIDER_DATA_DELETION_INITIATED',
      entity: 'Rider',
      entityId: riderId,
      details: { approvalToken }
    });

    return success({
      message: 'Rider soft-deleted successfully.'
    });
  } catch (error) {
    logger.error('Data deletion initiated failed:', error);
    
    await createAuditLog({
      actorId,
      actorType: 'ADMIN',
      action: 'RIDER_DATA_DELETION_FAILED',
      entity: 'Rider',
      entityId: riderId,
      details: { error: error instanceof Error ? error.message : String(error) },
    }).catch(() => {});

    return errors.internal('Failed to initiate data deletion');
  }
}
