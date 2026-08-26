import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';
import { legalUseCases } from '@/server/modules/legal/legal.use-cases';

export const dynamic = 'force-dynamic';

/**
 * W9 / L-1: revision history surface for legal documents.
 *
 *   GET    /api/admin/legal/[type]/revisions                     — list
 *   POST   /api/admin/legal/[type]/revisions?revisionId=<id>     — restore
 *
 * Restores reuse `legalUseCases.upsert`, so the restore itself is
 * snapshotted as the newest revision (forward-rollback stays possible).
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'settings_manage')) return adminForbidden();

  const { type } = await params;
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
    const revisions = await legalUseCases.listRevisions(
      type,
      Number.isFinite(limit) ? limit : 50
    );
    if (revisions === null) {
      return errors.notFound(`Legal document not found: ${type}`);
    }
    return success({ type, revisions });
  } catch (err) {
    logger.error('GET /api/admin/legal/[type]/revisions error:', err);
    return errors.internal('Failed to fetch legal revisions');
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // Restores overwrite rider-facing terms/privacy — manage-level only.
  if (!hasPermission(session, 'settings_manage')) return adminForbidden();

  const { type } = await params;
  try {
    const body = await req.json().catch(() => ({}) as Record<string, unknown>);
    const revisionId =
      typeof body.revisionId === 'string' ? body.revisionId : req.nextUrl.searchParams.get('revisionId');
    if (!revisionId) {
      return errors.badRequest('revisionId is required');
    }

    const actorId = session.adminId ?? session.riderDbId ?? 'system';
    const restored = await legalUseCases.restoreRevision(type, revisionId, actorId);

    createAuditLog({
      actorId,
      action: 'legal.restore_revision',
      entity: 'legal',
      entityId: restored.id,
      details: JSON.stringify({ type, revisionId }),
    }).catch(() => {});

    return success(restored, 'Legal document restored from revision');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('POST /api/admin/legal/[type]/revisions error:', err);
    if (msg.includes('not found')) return errors.notFound(msg);
    return errors.internal('Failed to restore legal revision');
  }
}
