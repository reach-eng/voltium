import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { calculateRiderScore } from '@/lib/score-calculator';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const scoreUseCases = {
  async list(params: {
    riskLevel?: string;
    minScore?: number;
    search?: string;
    hubId?: string;
    page?: number;
    limit?: number;
  }) {
    const { riskLevel, minScore, search, hubId, page = 1, limit = 20 } = params;
    const where: Prisma.RiderScoreWhereInput = {};
    if (riskLevel) where.riskLevel = riskLevel as Prisma.RiderScoreWhereInput['riskLevel'];
    if (minScore) where.compositeScore = { gte: minScore };
    if (search || hubId) {
      where.rider = {
        ...(search
          ? {
              OR: [
                { fullName: { contains: search, mode: 'insensitive' } },
                { riderId: { contains: search, mode: 'insensitive' } },
                { phone: { contains: search } },
              ],
            }
          : {}),
        ...(hubId && hubId !== 'ALL' ? { pickupHub: hubId } : {}),
      };
    }

    const [scores, total, lowCount, mediumCount, highCount, criticalCount] = await Promise.all([
      db.riderScore.findMany({
        where,
        orderBy: { compositeScore: 'asc' },
        include: {
          rider: {
            select: {
              fullName: true,
              riderId: true,
              phone: true,
              lifecycleStatus: true,
              pickupHub: true,
            },
          },
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.riderScore.count({ where }),
      db.riderScore.count({ where: { riskLevel: 'LOW' } }),
      db.riderScore.count({ where: { riskLevel: 'MEDIUM' } }),
      db.riderScore.count({ where: { riskLevel: 'HIGH' } }),
      db.riderScore.count({ where: { riskLevel: 'CRITICAL' } }),
    ]);

    const formatted = scores.map((s) => ({
      id: s.id,
      riderId: s.riderId,
      fullName: s.rider?.fullName || s.rider?.phone,
      phone: s.rider?.phone,
      riderState: s.rider?.lifecycleStatus,
      riderAccountStatus: s.rider?.lifecycleStatus,
      pickupHub: s.rider?.pickupHub,
      paymentScore: s.paymentScore,
      complianceScore: s.kycScore,
      engagementScore: s.activityScore,
      supportScore: s.supportScore,
      vehicleScore: 0,
      locationScore: 0,
      compositeScore: s.compositeScore,
      riskLevel: s.riskLevel,
      lastCalculated: s.lastCalculated,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return {
      scores: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
      riskCounts: {
        all: lowCount + mediumCount + highCount + criticalCount,
        LOW: lowCount,
        MEDIUM: mediumCount,
        HIGH: highCount,
        CRITICAL: criticalCount,
      },
    };
  },

  async recalculate(riderId: string, actorId: string) {
    const rider = await db.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new Error('Rider not found');

    const score = await calculateRiderScore(riderId, true);
    createAuditLog({
      actorId,
      action: 'score.recalculate',
      entity: 'rider_score',
      entityId: score.id,
      details: { riderId, compositeScore: score.compositeScore, riskLevel: score.riskLevel },
    }).catch((e) => logger.error('Audit log failed', e));
    return score;
  },

  async recalculateAll(actorId: string) {
    const riders = await db.rider.findMany({ select: { id: true } });

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];
    const BATCH_SIZE = 20;

    for (let i = 0; i < riders.length; i += BATCH_SIZE) {
      const chunk = riders.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        chunk.map((rider: { id: string }) => calculateRiderScore(rider.id, true))
      );
      results.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          successCount++;
        } else {
          failureCount++;
          const riderId = chunk[idx].id;
          const msg = res.reason instanceof Error ? res.reason.message : String(res.reason);
          errors.push(`Failed for rider ${riderId}: ${msg}`);
          logger.error(`Score recalculation failed for rider ${riderId}:`, res.reason);
        }
      });
    }

    createAuditLog({
      actorId,
      action: 'score.recalculate_all',
      entity: 'rider_score',
      details: { total: riders.length, success: successCount, failed: failureCount },
    }).catch((e) => logger.error('Audit log failed for score.recalculate_all', e));

    return {
      total: riders.length,
      successCount,
      failureCount,
      errors: errors.slice(0, 10),
    };
  },
};
