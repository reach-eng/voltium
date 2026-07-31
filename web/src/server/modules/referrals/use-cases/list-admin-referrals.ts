import { db } from '@/lib/db';

interface RefereeRow {
  riderId: string;
  fullName: string | null;
  phone: string;
  lifecycleStatus: string;
  createdAt: Date;
  referredBy: string | null;
}

export async function listAdminReferrals(filters: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}) {
  const { page = 1, limit = 20, search, status } = filters;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = { referredBy: { not: null } };
  if (status && status !== 'all') {
    where.lifecycleStatus = status;
  }
  if (search) {
    (where as Record<string, unknown>).OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { referredBy: { contains: search, mode: 'insensitive' } },
    ];
  }

  const total = await db.rider.count({ where });

  const referees = await db.rider.findMany({
    where,
    select: {
      riderId: true,
      fullName: true,
      phone: true,
      lifecycleStatus: true,
      createdAt: true,
      referredBy: true,
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  });

  const ids = new Set<string>();
  for (const r of referees) {
    if (r.referredBy) ids.add(r.referredBy);
  }
  const referrerIdentifiers = Array.from(ids);

  const referrers =
    referrerIdentifiers.length > 0
      ? await db.rider.findMany({
          where: {
            OR: [
              { id: { in: referrerIdentifiers } },
              { referralCode: { in: referrerIdentifiers } },
            ],
          },
          select: { id: true, referralCode: true, fullName: true },
        })
      : [];

  const referrerMap = new Map<
    string,
    { id: string; referralCode: string; fullName: string | null }
  >();
  for (const r of referrers) {
    referrerMap.set(r.id, r);
    referrerMap.set(r.referralCode, r);
  }

  const data = referees.map((referee: RefereeRow) => {
    const referrer = referee.referredBy ? referrerMap.get(referee.referredBy) : undefined;
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
    const rank = lifecycleRank[referee.lifecycleStatus] ?? 0;
    const isActive = rank >= 11;
    return {
      refereeId: referee.riderId,
      refereeName: referee.fullName || 'Unknown',
      refereePhone: referee.phone,
      refereeState: referee.lifecycleStatus,
      referredAt: referee.createdAt,
      referrerName: referrer ? referrer.fullName || 'Unknown' : 'Unknown Referrer',
      referrerCode: referrer?.referralCode || referee.referredBy || '',
      earningForReferrer: isActive ? 500 : 0,
    };
  });

  const hasMore = skip + referees.length < total;

  const [allLeads, activeRiders] = await Promise.all([
    db.rider.count({ where: { referredBy: { not: null } } }),
    db.rider.count({
      where: {
        referredBy: { not: null },
        lifecycleStatus: 'ACTIVE',
      },
    }),
  ]);

  return {
    page,
    limit,
    total,
    hasMore,
    referrals: data,
    summary: {
      totalLeads: allLeads,
      activeRiders,
      totalEarnings: activeRiders * 500,
    },
  };
}
