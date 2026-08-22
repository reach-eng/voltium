import { NextRequest } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { success, errors } from '@/lib/api-response';
import { validateBody } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { db } from '@/lib/db';
import { createAuditLog } from '@/lib/audit-log';

const undoSchema = z.object({
  items: z.array(z.object({
    id: z.string().min(1),
    isActive: z.boolean(),
  })),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // PR-1 (2026-08-06 fix plan): canonical key — `tl_manage` is a legacy alias.
  // Accept both so admins with stored legacy permissions aren't locked out.
  const canManage =
    hasPermission(session, 'team_leaders_manage') ||
    hasPermission(session, 'tl_manage');
  if (!canManage) return adminForbidden();

  try {
    const body = await req.json();
    const validation = validateBody(undoSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { items } = validation.data;
    
    if (items.length === 0) {
      return success({ count: 0 });
    }

    await db.$transaction(async (tx) => {
      // Execute all updates
      await Promise.all(
        items.map(item =>
          tx.teamLeader.update({
            where: { id: item.id },
            data: { isActive: item.isActive, deletedAt: null },
          })
        )
      );

      // Log a single audit entry
      await createAuditLog({
        actorId: session.adminId || '',
        action: 'tl.bulk_undo',
        entity: 'team_leader',
        entityId: 'multiple',
        details: { count: items.length, items: items.map(i => i.id) },
      });
    });

    return success({ count: items.length }, 'Bulk undo successful');
  } catch (error) {
    logger.error('POST /api/admin/team-leaders/bulk/undo error:', error);
    return errors.internal('Failed to undo team leader changes');
  }
}
