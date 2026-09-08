import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { validateBody, teamLeaderBulkActionSchema } from '@/lib/validators';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden, canManageTeamLeaders } from '@/lib/rbac';
import { teamLeaderUseCases, TeamLeaderStateError } from '@/server/modules/team-leaders/team-leader.use-cases';
import { invalidateCache } from '@/lib/cache';

export async function POST(req: NextRequest) {
  try {
    const session = await requireAdmin();
    if (!session) return adminUnauthorized();
    if (!canManageTeamLeaders(session.adminRole || '')) return adminForbidden();

    const body = await req.json();
    const validation = validateBody(teamLeaderBulkActionSchema, body);
    if (!validation.success) return errors.validation(validation.error);

    const { ids, action } = validation.data;
    const actorId = session.adminId || '';

    let count = 0;
    switch (action) {
      case 'activate':
        count = await teamLeaderUseCases.bulkActivate(ids, actorId);
        break;
      case 'deactivate':
        count = await teamLeaderUseCases.bulkDeactivate(ids, actorId);
        break;
      case 'delete':
        count = await teamLeaderUseCases.bulkDelete(ids, actorId);
        break;
      default:
        return errors.badRequest('Invalid action');
    }

    invalidateCache('admin:team-leaders:*');
    return success({ count }, 'Bulk action completed');
  } catch (error) {
    if (error instanceof TeamLeaderStateError) {
      return errors.conflict(error.message);
    }
    logger.error('POST /api/admin/team-leaders/bulk error:', error);
    return errors.internal('Failed to process bulk action');
  }
}
