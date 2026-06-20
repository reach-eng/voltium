import { db } from '@/lib/db';
import { calculateRiderScore } from '@/lib/score-calculator';
import { createAuditLog } from '@/lib/audit-log';
import { logger } from '@/lib/logger';

export const scoreUseCases = {
  async list(params: { riskLevel?: string; minScore?: number; search?: string; page?: number; limit?: number }) {
    const { riskLevel, minScore, search, page = 1, limit = 20 } = params;
    const where: Record<string, unknown> = {};
    if (riskLevel) where.riskLevel = riskLevel;
    if (minScore) (where as any).compositeScore = { gte: minScore };
    if (search) {
      (where as any).rider = { OR: [{ fullName: { contains: search } }, { riderId: { contains: search } }, { phone: { contains: search } }] };
    }

    const [scores, total] = await Promise.all([
      db.riderScore.findMany({
        where, orderBy: { compositeScore: 'asc' },
        include: { rider: { select: { fullName: true, riderId: true, phone: true, lifecycleStatus: true, pickupHub: true } } },
        skip: (page - 1) * limit, take: limit,
      }),
      db.riderScore.count({ where }),
    ]);

    const formatted = (scores as any[]).map((s) => ({
      id: s.id, riderId: s.riderId, fullName: s.rider?.fullName || s.rider?.phone, phone: s.rider?.phone,
      riderState: s.rider?.lifecycleStatus, riderAccountStatus: s.rider?.lifecycleStatus, pickupHub: s.rider?.pickupHub,
      paymentScore: s.paymentScore, complianceScore: s.kycScore, engagementScore: s.activityScore,
      supportScore: s.supportScore, vehicleScore: 0, locationScore: 0,
      compositeScore: s.compositeScore, riskLevel: s.riskLevel, lastCalculated: s.lastCalculated,
      createdAt: s.createdAt, updatedAt: s.updatedAt,
    }));

    return { scores: formatted, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  },

  async recalculate(riderId: string, actorId: string) {
    const rider = await db.rider.findUnique({ where: { id: riderId } });
    if (!rider) throw new Error('Rider not found');

    const score = await calculateRiderScore(riderId);
    createAuditLog({ actorId, action: 'score.recalculate', entity: 'rider_score', entityId: score.id, details: { riderId, compositeScore: score.compositeScore, riskLevel: score.riskLevel } }).catch((e) => logger.error('Audit log failed', e));
    return score;
  },

  async recalculateAll(actorId: string) {
    const riders = await db.rider.findMany({ select: { id: true } });

    let successCount = 0;
    let failureCount = 0;
    const errors: string[] = [];

    for (const rider of riders) {
      try {
        await calculateRiderScore(rider.id);
        successCount++;
      } catch (err) {
        failureCount++;
        errors.push(`Failed for rider ${rider.id}: ${(err as Error).message}`);
        logger.error(`Score recalculation failed for rider ${rider.id}:`, err);
      }
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
