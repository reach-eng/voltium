import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { legalUseCases } from '@/server/modules/legal/legal.use-cases';

export const dynamic = 'force-dynamic';

/**
 * L-1b / W9 / L-1: explicit publish gate — SUPER_ADMIN only.
 *
 *   POST /api/admin/legal/[type]/publish
 *
 * Flips a DRAFT legal document to PUBLISHED (rider-visible). Idempotent:
 * publishing an already-published doc is a no-op that returns the row.
 *
 * Permission: `legal_publish` (SUPER_ADMIN). Editors who hold only
 * `legal_manage` (OPERATIONS_ADMIN) can save/draft but cannot publish.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // L-1b: gate on legal_publish, not legal_manage. This ensures editors
  // (OPERATIONS_ADMIN) cannot silently make DRAFT content rider-visible.
  if (!hasPermission(session, 'legal_publish')) return adminForbidden();

  const { type } = await params;
  try {
    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const published = await legalUseCases.publish(type, actorId);
    return success(published, 'Legal document published');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('POST /api/admin/legal/[type]/publish error:', err);
    if (msg.includes('not found')) return errors.notFound(msg);
    return errors.internal('Failed to publish legal document');
  }
}
