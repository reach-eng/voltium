import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const rewardRepository = {
  async findAllPaginated(params: { search?: string | null; page: number; limit: number }) {
    const { search, page, limit } = params;
    const where: Prisma.RewardWhereInput = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { rider: { fullName: { contains: search, mode: 'insensitive' } } },
        { rider: { riderId: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [rewards, total] = await Promise.all([
      db.reward.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { rider: { select: { fullName: true, riderId: true } } },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.reward.count({ where }),
    ]);

    const formatted = rewards.map((r) => ({
      id: r.id,
      riderName: r.rider.fullName || 'Unknown',
      riderId: r.rider.riderId,
      title: r.title,
      points: r.points,
      createdAt: r.createdAt,
    }));

    return {
      rewards: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async getSummary() {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [totalStats, uniqueRidersCount, thisMonthStats] = await Promise.all([
      db.reward.aggregate({
        _sum: { points: true },
      }),
      db.reward.groupBy({
        by: ['riderId'],
      }),
      db.reward.aggregate({
        where: { createdAt: { gte: startOfMonth } },
        _sum: { points: true },
        _count: true,
      }),
    ]);

    return {
      totalPoints: totalStats._sum.points || 0,
      uniqueRiders: uniqueRidersCount.length,
      thisMonthCount: thisMonthStats._count || 0,
      thisMonthPoints: thisMonthStats._sum.points || 0,
    };
  },

  async findById(id: string) {
    return db.reward.findUnique({
      where: { id },
      include: { rider: { select: { fullName: true, riderId: true } } },
    });
  },

  async create(data: Prisma.RewardCreateInput) {
    return db.reward.create({ data });
  },

  async delete(id: string) {
    return db.reward.delete({ where: { id } });
  },

  async update(id: string, data: Prisma.RewardUpdateInput) {
    return db.reward.update({ where: { id }, data });
  },
};
