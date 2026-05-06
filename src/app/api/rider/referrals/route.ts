import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';

const REWARD_PER_REFERRAL = 500; // In Rupees

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRiderSession(req);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { referralCode: true }
    });

    if (!rider || !rider.referralCode) {
      return errors.notFound('Referral code not found for this rider');
    }

    // Find all riders referred by this rider's code
    const referrals = await db.rider.findMany({
      where: { referredBy: rider.referralCode },
      select: {
        id: true,
        riderId: true,
        fullName: true,
        phone: true,
        state: true,
        planStatus: true,
        rentalStatus: true,
        createdAt: true,
        kycProfile: {
           select: { profilePhoto: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const { maskPhone } = await import('@/lib/pii');

    const detailedReferrals = referrals.map((ref: any) => {
      const isActive = ref.state === 'ACTIVE' || ref.state === 'POST_ACTIVE';
      return {
        id: ref.id,
        riderId: ref.riderId,
        name: ref.fullName || 'Unknown Rider',
        phone: maskPhone(ref.phone),
        status: ref.state,
        planStatus: ref.planStatus,
        rentalStatus: ref.rentalStatus,
        paymentStatus: ref.planStatus === 'ACTIVE' ? 'Paid & Active' : 'Payment Pending',
        photo: ref.kycProfile?.profilePhoto || null,
        earned: isActive ? REWARD_PER_REFERRAL : 0,
        potential: !isActive ? REWARD_PER_REFERRAL : 0,
        joinedAt: ref.createdAt
      };
    });

    const totalEarned = detailedReferrals.reduce((sum: any, r: any) => sum + r.earned, 0);
    const potentialEarnings = detailedReferrals.reduce((sum: any, r: any) => sum + r.potential, 0);

    return success({
      referralCode: rider.referralCode,
      stats: {
        totalReferred: detailedReferrals.length,
        totalEarned,
        potentialEarnings,
      },
      referrals: detailedReferrals
    }, 'Referral data fetched');
  } catch (err) {
    logger.error('[GET /api/rider/referrals]', err);
    return errors.internal('Failed to fetch referral data');
  }
}
