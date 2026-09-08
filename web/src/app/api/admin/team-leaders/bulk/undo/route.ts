import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden, canManageTeamLeaders } from '@/lib/rbac';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';
import { invalidateCache } from '@/lib/cache';

const undoSchema = z.object({
  items: z.array(
    z.object({
      id: z.string().min(1),
      isActive: z.boolean(),
    })
  ),
  action: z.enum(['activate', 'deactivate', 'delete']).optional(),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!canManageTeamLeaders(session.adminRole || '')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(undoSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { items, action } = validation.data;

    if (items.length === 0) {
      return success({ count: 0 });
    }

    await db.$transaction(async (tx) => {
      if (action === 'delete') {
        // Explicit undo of delete restores deletedAt: null
        await Promise.all(
          items.map((item) =>
            tx.teamLeader.update({
              where: { id: item.id },
              data: { isActive: item.isActive, deletedAt: null },
            })
          )
        );
      } else {
        // Undoing activate/deactivate ONLY affects non-deleted rows
        await Promise.all(
          items.map((item) =>
            tx.teamLeader.updateMany({
              where: { id: item.id, deletedAt: null },
              data: { isActive: item.isActive },
            })
          )
        );
      }

      // Log a single audit entry
      await createAuditLog({
        actorId: session.adminId || '',
        action: 'teamleader.bulk_undo',
        entity: 'team_leader',
        entityId: 'multiple',
        details: { count: items.length, items: items.map((i) => i.id), action },
      });
    });

    invalidateCache('admin:team-leaders:*');

    return success({ count: items.length }, 'Bulk undo successful');
  } catch (error) {
    logger.error('POST /api/admin/team-leaders/bulk/undo error:', error);
    return errors.internal('Failed to undo team leader changes');
  }
}
