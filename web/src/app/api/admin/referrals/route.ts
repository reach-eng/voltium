import { NextRequest } from 'next/server';
import { success, errors, withCacheHeaders } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireAdmin, adminUnauthorized, adminForbidden } from '@/lib/rbac';
import { parsePositiveInt } from '@/lib/api-utils';
import { hasPermission } from '@/lib/auth';
import { referralUseCases } from '@/server/modules/referrals/referral.use-cases';

export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'referrals_view')) return adminForbidden();

  try {
    // DEEP-AUDIT D-P1-1: parsePositiveInt (NaN-safe) replaces the removed
    // parsePaginationParams helper.
    const page = parsePositiveInt(req.nextUrl.searchParams.get('page'), 1);
    const limit = parsePositiveInt(req.nextUrl.searchParams.get('limit'), 20, 100);
    const search = req.nextUrl.searchParams.get('search') || undefined;
    const status = req.nextUrl.searchParams.get('status') || undefined;

    const result = await referralUseCases.listAdminReferrals({ page, limit, search, status });

    return withCacheHeaders(success(result), 10);
  } catch (error) {
    logger.error('GET /api/admin/referrals error:', error);
    return errors.internal('Failed to fetch referrals');
  }
}

import { z } from 'zod';

const ProcessReferralSchema = z.object({
  referrerId: z.string().min(1, 'Referrer ID is required'),
  refereeId: z.string().min(1, 'Referee ID is required'),
});

export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  if (!hasPermission(session, 'rewards_manage')) return adminForbidden();

  try {
    const raw = await req.json();
    const parsed = ProcessReferralSchema.safeParse(raw);
    if (!parsed.success) {
      return errors.badRequest(
        parsed.error.issues.map((i) => `${i.path.join('.') || 'body'}: ${i.message}`).join('; ')
      );
    }
    const { referrerId, refereeId } = parsed.data;

    const { db } = await import('@/lib/db');
    
    // Find referrer to get their code
    const referrer = await db.rider.findUnique({
      where: { id: referrerId },
      select: { referralCode: true }
    });

    if (!referrer || !referrer.referralCode) {
      return errors.badRequest('Referrer not found or has no referral code');
    }

    // Process the reward
    await referralUseCases.processReferralReward(refereeId, referrer.referralCode);

    return success({ message: 'Referral processed successfully' });
  } catch (error) {
    logger.error('POST /api/admin/referrals error:', error);
    return errors.internal('Failed to process referral');
  }
}

