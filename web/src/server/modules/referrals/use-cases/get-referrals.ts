import { db } from '@/lib/db';

const REWARD_PER_REFERRAL = 500;

/**
 * Get referral data for a rider.
 */
export async function getReferrals(riderDbId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: { referralCode: true },
  });

  if (!rider || !rider.referralCode) return null;

  const referrals = await db.rider.findMany({
    where: { referredBy: rider.referralCode },
    select: {
      id: true,
      riderId: true,
      fullName: true,
      phone: true,
      lifecycleStatus: true,
      createdAt: true,
      kycProfile: { select: { profilePhoto: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  const { maskPhone } = await import('@/lib/pii');
  const detailedReferrals = referrals.map((ref: any) => {
    const lifecycleRank: Record<string, number> = {
      NEW: 0,
      PHONE_VERIFIED: 1,
      PROFILE_SUBMITTED: 2,
      KYC_SUBMITTED: 3,
      KYC_APPROVED: 4,
      GUARANTOR_SUBMITTED: 5,
      GUARANTOR_APPROVED: 6,
      DEPOSIT_PENDING: 7,
      DEPOSIT_APPROVED: 8,
      PLAN_SELECTED: 9,
      PICKUP_SCHEDULED: 10,
      ACTIVE: 11,
      SUSPENDED: 12,
      RETURN_PENDING: 13,
      CLOSED: 14,
    };
    const rank = lifecycleRank[ref.lifecycleStatus] ?? 0;
    const isActive = rank >= 11;
    return {
      id: ref.id,
      riderId: ref.riderId,
      name: ref.fullName || 'Unknown Rider',
      phone: maskPhone(ref.phone),
      status: ref.lifecycleStatus,
      planStatus: rank >= 9 ? 'ACTIVE' : 'NONE',
      rentalStatus: rank >= 10 ? 'ACTIVE' : 'NONE',
      paymentStatus: rank >= 9 ? 'Paid & Active' : 'Payment Pending',
      photo: ref.kycProfile?.profilePhoto || null,
      earned: isActive ? REWARD_PER_REFERRAL : 0,
      potential: !isActive ? REWARD_PER_REFERRAL : 0,
      joinedAt: ref.createdAt,
    };
  });

  const totalEarned = detailedReferrals.reduce((sum: any, r: any) => sum + r.earned, 0);
  const potentialEarnings = detailedReferrals.reduce((sum: any, r: any) => sum + r.potential, 0);

  return {
    referralCode: rider.referralCode,
    stats: { totalReferred: detailedReferrals.length, totalEarned, potentialEarnings },
    referrals: detailedReferrals,
  };
}
