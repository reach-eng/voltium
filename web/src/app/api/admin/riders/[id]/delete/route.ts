/**
 * DELETE /api/admin/riders/[id]/delete
 * Soft delete a rider with audit trail
 */

import { NextRequest } from 'next/server';
import { softDelete, getDeletionHistory } from '@/lib/soft-delete';
import { requirePermission } from '@/lib/rbac';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission('riders_delete');
  if (!session) return errors.unauthorized('Admin authentication required');

  try {
    const body = await req.json();
    const { reason = 'Admin deletion' } = body;

    if (!reason || reason.length < 5) {
      return errors.badRequest('Deletion reason must be at least 5 characters');
    }

    const result = await softDelete('Rider', params.id, {
      deletedBy: session.adminId || 'unknown',
      reason,
    });

    if (!result.success) {
      return errors.internal(result.error || 'Failed to delete rider');
    }

    return success(result.data, 'Rider soft-deleted successfully', 200);
  } catch (error) {
    logger.error('[DELETE_RIDER]', error);
    return errors.internal('Failed to delete rider');
  }
}

/**
 * GET /api/admin/riders/[id]/delete/history
 * Get deletion history for a rider
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await requirePermission('riders_view');
  if (!session) return errors.unauthorized();

  try {
    const history = await getDeletionHistory('Rider', 50);

    const riderDeletions = history.filter(
      (log) => log.entityId === params.id && log.action === 'DELETE'
    );

    return success(riderDeletions, 'Deletion history retrieved');
  } catch (error) {
    logger.error('[GET_RIDER_DELETION_HISTORY]', error);
    return errors.internal('Failed to fetch deletion history');
  }
}
