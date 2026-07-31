import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { scoreUseCases } from '@/server/modules/scores/score.use-cases';

import { checkRateLimit } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'riders_manage')) return adminForbidden();

  const adminId = session.adminId || session.riderDbId || 'system';
  const rl = await checkRateLimit(`recalculate-scores:${adminId}`, { windowMs: 60 * 1000, maxRequests: 5 });
  if (!rl.allowed) return errors.tooManyRequests('Too many score recalculation requests');

  try {
    const result = await scoreUseCases.recalculateAll(session.adminId || '');

    return success(
      {
        total: result.total,
        successCount: result.successCount,
        failureCount: result.failureCount,
        errors: result.errors,
      },
      `Recalculated scores for ${result.successCount} riders`
    );
  } catch (error) {
    return errors.internal('Failed to recalculate scores');
  }
}
