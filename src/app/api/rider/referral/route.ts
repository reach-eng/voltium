import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { success, errors } from '@/lib/api-response';
import { logger } from '@/lib/logger';
import { requireRiderSession } from '@/lib/rider-auth';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRiderSession(request);
    if (auth instanceof Response) return auth;
    const riderDbId = auth.riderDbId;

    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: {
        referralCode: true,
        referredBy: true,
      },
    });

    if (!rider) {
      return errors.notFound('Rider not found');
    }

    // Find all riders who used this rider's referral code
    // Include kycProfile to get kycStatus from the relation
    const referredUsers = await db.rider.findMany({
      where: { referredBy: rider.referralCode },
      select: {
        fullName: true,
        phone: true,
        accountStatus: true,
        createdAt: true,
        kycProfile: {
          select: { status: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const { maskPhone } = await import('@/lib/pii');

    const formattedReferredUsers = referredUsers.map((u: any) => ({
      name: u.fullName || 'Unknown',
      phone: maskPhone(u.phone),
      kycStatus: u.kycProfile?.status || 'PENDING',
      status: u.kycProfile?.status === 'APPROVED' ? 'COMPLETED' : (u.kycProfile?.status || 'PENDING'),
      date: u.createdAt,
    }));

    return success({
      referralCode: rider.referralCode,
      referredBy: rider.referredBy || null,
      referredUsers: formattedReferredUsers,
    });
  } catch (err) {
    logger.error('[GET /api/rider/referral]', err);
    return errors.internal('Failed to fetch referral data');
  }
}
