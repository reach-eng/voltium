/**
 * Referrals module - Use cases.
 *
 * Orchestrates referral reward processing: credit referrer when referee completes onboarding.
 */

import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';

const REWARD_PER_REFERRAL = 500;

interface RefereeRow {
  riderId: string;
  fullName: string | null;
  phone: string;
  lifecycleStatus: string;
  createdAt: Date;
  referredBy: string | null;
}

interface ReferrerInfo {
  id: string;
  referralCode: string;
  fullName: string | null;
}

export const referralUseCases = {
  /**
   * Processes a referral reward when a new rider signs up with a referral code.
   * Credits the referrer's wallet via the referral reward mechanism.
   * Idempotent — checks for existing transactions before awarding.
   */
  async processReferralReward(refereeId: string, referrerCode: string) {
    const referrer = await db.rider.findUnique({ where: { referralCode: referrerCode } });
    const referee = await db.rider.findUnique({ where: { id: refereeId } });

    if (!referrer || !referee) {
      logger.warn('[Referral] Invalid referral data', { refereeId, referrerCode });
      return;
    }

    // Check if already rewarded (idempotency)
    const existingReward = await db.transaction.findFirst({
      where: { riderId: referrer.id, purpose: 'REWARD', description: { contains: referee.id } },
    });
    if (existingReward) {
      logger.info('[Referral] Reward already processed', { referrerId: referrer.id, refereeId });
      return;
    }

    // Read referral bonus from settings
    const setting = await db.setting.findFirst({ where: { key: 'referralBonus' } });
    const bonus = parseInt(setting?.value || '200');

    const bonusPaise = bonus * 100;
    const idempotencyKey = `referral:${referrer.id}:${refereeId}`;

    await db.$transaction(async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.wallet.findUnique({
        where: { riderId: referrer.id },
        select: { id: true },
      });

      if (!wallet) {
        logger.warn('[Referral] No wallet for referrer', { referrerId: referrer.id });
        return;
      }

      const txn = await tx.transaction.create({
        data: {
          riderId: referrer.id,
          amount: bonusPaise,
          type: 'CREDIT',
          purpose: 'REWARD',
          status: 'APPROVED',
          description: `Referral reward for ${referee.fullName || referee.phone}`,
          approvedAt: new Date(),
        },
      });

      await walletLedgerService.credit({
        riderId: referrer.id,
        amountInPaise: bonusPaise,
        category: 'REWARD',
        txnId: txn.id,
        idempotencyKey,
        note: `Referral reward for ${referee.fullName || referee.phone}`,
      });

      await tx.reward.create({
        data: {
          riderId: referrer.id,
          title: `Referral bonus: ${referee.fullName || referee.phone} joined`,
          points: bonusPaise,
        },
      });
    });

    createAuditLog({
      actorId: 'system',
      action: 'finance.referral_reward',
      entity: 'rider',
      entityId: referrer.id,
      details: { amountPaise: bonusPaise, refereeId },
    }).catch(() => {});

    logger.info('[Referral] Reward processed', {
      referrerId: referrer.id,
      refereeId,
      bonus,
    });
  },

  /**
   * Get referral data for a rider.
   */
  async getReferrals(riderDbId: string) {
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
  },

  async getReferralInfo(riderDbId: string) {
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { referralCode: true, referredBy: true },
    });
    if (!rider) throw new Error('Rider not found');
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
  },

  async listAdminReferrals(filters: {
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
  },
};
