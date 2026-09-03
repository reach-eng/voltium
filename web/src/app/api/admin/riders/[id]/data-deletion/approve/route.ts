import { randomUUID } from 'crypto';
import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { createAuditLog } from '@/lib/audit-log';
import { validateBody } from '@/lib/validators';
import { dataDeletionApproveSchema } from '@/lib/validators/admin';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await requirePermission('riders_delete_approve');
  if (!session) {
    return errors.forbidden('Insufficient permissions to approve data deletion');
  }

  const { id: riderId } = await context.params;
  
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    body = {};
  }

  const parsed = validateBody(dataDeletionApproveSchema, body);
  if (!parsed.success) {
    return errors.validation(parsed.error);
  }

  const rider = await db.rider.findUnique({
    where: { id: riderId }
  });

  if (!rider) {
    return errors.notFound('Rider not found');
  }

  const approvalToken = randomUUID();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 1);

  const actorId = session.adminId ?? session.riderDbId ?? 'system';

  await createAuditLog({
    actorId,
    actorType: 'ADMIN',
    action: 'RIDER_DATA_DELETION_APPROVED',
    entity: 'Rider',
    entityId: riderId,
    details: {
      approvalToken,
      requestedBy: actorId,
      expiresAt: expiresAt.toISOString(),
      notes: parsed.data?.notes,
      requestId: parsed.data?.requestId,
    },
  });

  return success({
    approvalToken,
    expiresAt: expiresAt.toISOString(),
  }, 'Data deletion approved. Approval token generated.');
}
