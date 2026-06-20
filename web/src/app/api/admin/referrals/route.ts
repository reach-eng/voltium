import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden, parsePaginationParams } from '@/lib/rbac';
import { hasPermission } from '@/lib/auth';
import { referralUseCases } from '@/server/modules/referrals/referral.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session.adminRole || '', 'referrals_view')) return adminForbidden();

  try {
    const { page, limit } = parsePaginationParams(req.nextUrl);
    const search = req.nextUrl.searchParams.get('search') || undefined;
    const status = req.nextUrl.searchParams.get('status') || undefined;

    const result = await referralUseCases.listAdminReferrals({ page, limit, search, status });

    return success(result);
  } catch (error) {
    logger.error('GET /api/admin/referrals error:', error);
    return errors.internal('Failed to fetch referrals');
  }
}
