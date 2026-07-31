import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

/**
 * Update security flags for a rider (admin lock, uninstall block, etc).
 */
export async function updateSecurityFlags(riderId: string, data: Record<string, unknown>, actorId: string) {
  const updateData = { ...data };
  if (updateData.lockPassword && typeof updateData.lockPassword === 'string') {
    const { hashPassword } = await import('@/lib/password');
    updateData.lockPasswordHash = await hashPassword(updateData.lockPassword as string);
    delete updateData.lockPassword;
  }
  await db.rider.update({ where: { id: riderId }, data: updateData });
  await createAuditLog({
    action: 'system.config_change',
    entityId: riderId,
    entity: 'rider',
    actorId,
    details: (({ lockPassword, lockPasswordHash, ...safe }) => safe)(data),
  });
}
