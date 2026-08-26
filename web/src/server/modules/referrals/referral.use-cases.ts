/**
 * Referrals module - Use cases.
 *
 * Orchestrates referral reward processing: credit referrer when referee completes onboarding.
 */

import { db } from '@/lib/db';
import { lifecycleRankOf } from '@/lib/lifecycle-ranks';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';
import { getCachedResponse, cacheResponse } from '@/lib/cache';
import { getCachedRider, invalidateRiderCache } from '@/lib/server-cache';

export async function getReferralBonusRupees(): Promise<number> {
  const cached = getCachedResponse<string>('setting:referralBonus');
  if (cached) return parseInt(cached, 10) / 100;
  const setting = await db.systemSetting.findFirst({ where: { key: 'referralBonus' } });
  const paise = parseInt(setting?.value || '20000', 10);
  cacheResponse('setting:referralBonus', String(paise), 60);
  return paise / 100;
}

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
   *
   * PR-102 (B-RF1): this use-case and `referral-reward.job.ts` MUST emit
   * the same `idempotencyKey` (`referral:{referrer.id}:{refereeId}`) and
   * the same amount so the database unique constraint on
   * `WalletLedger.idempotencyKey` is the single source of truth for
   * "only one reward may be paid for this (referrer, referee) pair".
   *
   * The use-case path is reached from the admin `POST /api/admin/referrals`
   * endpoint (manual reconciliation by an operator). The job path is the
   * default for the on-signup flow (PR-75). Both must converge.
   *
   * PR-102 (B-RF1): the job is the source of truth for new rewards
   * (it has exponential backoff, outbox retries, and the canonical
   * `setting:referralBonus` paise value). The use-case is kept as a
   * manual-reconciliation fallback for admins. Both paths are now
   * aligned on the paise value (no rupees→paise double-conversion
   * that previously inflated the use-case amount by 100x).
   */
  async processReferralReward(refereeId: string, referrerCode: string) {
    const referrer = await db.rider.findUnique({ where: { referralCode: referrerCode } });
    const referee = await getCachedRider(refereeId, () =>
      db.rider.findUnique({ where: { id: refereeId } })
    );

    if (!referrer || !referee) {
      logger.warn('[Referral] Invalid referral data', { refereeId, referrerCode });
      return;
    }

    // W6 / M-4: eligibility guards. An admin issuing an arbitrary
    // {referrerId, refereeId} pair must not mint rewards unless the
    // referee actually holds this referrer's code — and nobody refers
    // themselves.
    if (referrer.id === referee.id) {
      logger.warn('[Referral] Self-referral rejected', { refereeId });
      return;
    }
    if ((referee.referredBy ?? '') !== referrer.referralCode) {
      logger.warn('[Referral] Referee was not referred by this referrer', {
        refereeId,
        referrerId: referrer.id,
        referredBy: referee.referredBy ?? null,
      });
      return;
    }

    // PR-102: this key MUST match the key emitted by
    // referral-reward.job.ts. The `WalletLedger.idempotencyKey` UNIQUE
    // constraint is the only thing that prevents a double-pay if both
    // paths race (e.g. admin clicks reconcile while the job is running).
    const idempotencyKey = `referral:${referrer.id}:${refereeId}`;

    // W6 / M-4: authoritative idempotency pre-check on the LEDGER KEY.
    // The old check matched `description contains referee.id`, but the
    // stored description contains name/phone, so it never fired.
    const existingRewardKey = await db.walletLedger.findFirst({
      where: { idempotencyKey },
      select: { id: true },
    });
    if (existingRewardKey) {
      logger.info('[Referral] Reward already processed', { referrerId: referrer.id, refereeId });
      return;
    }

    // W6 / M-4: per-referrer lifetime reward cap (configurable). Without
    // this, an admin can mint unlimited REWARD credits by cycling
    // distinct referees through the endpoint.
    const capCount = parseInt(process.env.REFERRAL_REWARD_CAP || '100', 10);
    const rewardedCount = await db.transaction.count({
      where: { riderId: referrer.id, purpose: 'REWARD', status: 'APPROVED' },
    });
    if (rewardedCount >= capCount) {
      logger.warn('[Referral] Reward cap reached for referrer', {
        referrerId: referrer.id,
        cap: capCount,
      });
      return;
    }

    // Check if already rewarded (idempotency) — superseded by the
    // WalletLedger.idempotencyKey lookup above (W6 / M-4).

    // Read referral bonus from settings (cached 60s).
    // The value is stored in PAISE (see settings.registry.ts coerceSettingValue
    // which multiplies BUSINESS/NUMBER by 100). Default '20000' = ₹200 in
    // paise. We do NOT multiply by 100 again here — that would inflate
    // the use-case amount 100x vs the job path (PR-102 alignment).
    let settingVal = getCachedResponse<string>('setting:referralBonus');
    if (!settingVal) {
      const setting = await db.systemSetting.findFirst({ where: { key: 'referralBonus' } });
      settingVal = setting?.value || '20000';
      cacheResponse('setting:referralBonus', settingVal, 60);
    }
    const bonusPaise = parseInt(settingVal || '20000');

    await db.$transaction(async (tx) => {
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
          amountInPaise: bonusPaise,
          type: 'CREDIT',
          purpose: 'REWARD',
          status: 'APPROVED',
          description: `Referral reward for ${referee.fullName || referee.phone}`,
          approvedAt: new Date(),
        },
      });

      // W6 / M-4: pass the transaction through. Without `tx` the
      // credit commits in its own transaction while the Transaction and
      // Reward rows below remain in the outer one — a failure there
      // orphaned real money with no parent records.
      await walletLedgerService.credit({
        riderId: referrer.id,
        amountInPaise: bonusPaise,
        category: 'REWARD',
        txnId: txn.id,
        idempotencyKey,
        note: `Referral reward for ${referee.fullName || referee.phone}`,
      }, tx);

      await tx.reward.create({
        data: {
          riderId: referrer.id,
          title: `Referral bonus: ${referee.fullName || referee.phone} joined`,
          points: bonusPaise,
        },
      });
    });

    invalidateRiderCache(referrer.id);

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
      bonusPaise,
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
    const bonusRupees = await getReferralBonusRupees();
    const detailedReferrals = referrals.map((ref) => {
      // P1-12: shared lifecycle ranking (single source of truth).
      const rank = lifecycleRankOf(ref.lifecycleStatus);
      const isActive = rank === 11;
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
        earned: isActive ? bonusRupees : 0,
        potential: !isActive ? bonusRupees : 0,
        joinedAt: ref.createdAt,
      };
    });

    const totalEarned = detailedReferrals.reduce((sum, r) => sum + r.earned, 0);
    const potentialEarnings = detailedReferrals.reduce((sum, r) => sum + r.potential, 0);

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
    const formattedReferredUsers = referredUsers.map((u) => ({
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

    const bonusRupees = await getReferralBonusRupees();
    const data = referees.map((referee: RefereeRow) => {
      const referrer = referee.referredBy ? referrerMap.get(referee.referredBy) : undefined;
      // P1-12: shared lifecycle ranking (single source of truth).
      const rank = lifecycleRankOf(referee.lifecycleStatus);
      const isActive = rank === 11;
      return {
        refereeId: referee.riderId,
        refereeName: referee.fullName || 'Unknown',
        refereePhone: referee.phone,
        refereeState: referee.lifecycleStatus,
        referredAt: referee.createdAt,
        referrerName: referrer ? referrer.fullName || 'Unknown' : 'Unknown Referrer',
        referrerCode: referrer?.referralCode || referee.referredBy || '',
        earningForReferrer: isActive ? bonusRupees : 0,
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
        totalEarnings: activeRiders * bonusRupees,
      },
    };
  },
};
