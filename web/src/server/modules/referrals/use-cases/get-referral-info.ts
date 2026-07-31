import { db } from '@/lib/db';
import { NotFoundError } from "@/lib/api-error";

export async function getReferralInfo(riderDbId: string) {
  const rider = await db.rider.findUnique({
    where: { id: riderDbId },
    select: { referralCode: true, referredBy: true },
  });
  if (!rider) throw new NotFoundError('Rider not found');
  
  const referredUsers = await db.rider.findMany({
    where: { referredBy: rider.referralCode },
    select: {
      fullName: true,
      phone: true,
      lifecycleStatus: true,
      createdAt: true,
      kycProfile: { select: { status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  
  const { maskPhone } = await import('@/lib/pii');
  const formattedReferredUsers = referredUsers.map((u: any) => ({
    name: u.fullName || 'Unknown',
    phone: maskPhone(u.phone),
    kycStatus: u.kycProfile?.status || 'PENDING',
    status: u.kycProfile?.status === 'APPROVED' ? 'COMPLETED' : u.kycProfile?.status || 'PENDING',
    date: u.createdAt,
  }));
  
  return {
    referralCode: rider.referralCode,
    referredBy: rider.referredBy || null,
    referredUsers: formattedReferredUsers,
  };
}
