import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { adminFaqUseCases } from '@/server/modules/support/admin-faq.use-cases';
import { z } from 'zod';

const reorderFaqSchema = z.object({
  id: z.string().min(1, 'FAQ id is required'),
  direction: z.enum(['up', 'down']),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'faq_manage')) return adminForbidden();

  try {
    const body = await req.json();
    const validation = reorderFaqSchema.safeParse(body);
    if (!validation.success) {
      return errors.validation(validation.error.issues.map((i) => i.message).join('; '));
    }

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const result = await adminFaqUseCases.reorder(validation.data.id, validation.data.direction, actorId);
    return success(result, 'FAQ reordered successfully');
  } catch (error: unknown) {
    logger.error('POST /api/admin/faqs/reorder error:', error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('not found')) return errors.notFound(msg);
    return errors.internal('Failed to reorder FAQ');
  }
}
