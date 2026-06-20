import { db } from '@/lib/db';

export const rewardRepository = {
  async findAllPaginated(params: { search?: string | null; page: number; limit: number }) {
    const { search, page, limit } = params;
    const where: any = {};
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

    const formatted = rewards.map((r: any) => ({
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
    const allRewards = await db.reward.findMany({
      select: { points: true, createdAt: true, riderId: true },
    });
    const totalPoints = allRewards.reduce((sum: number, r: any) => sum + r.points, 0);
    const uniqueRiders = new Set(allRewards.map((r: any) => r.riderId)).size;
    const now = new Date();
    const thisMonth = allRewards.filter((r: any) => {
      const d = new Date(r.createdAt);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    return {
      totalPoints,
      uniqueRiders,
      thisMonthCount: thisMonth.length,
      thisMonthPoints: thisMonth.reduce((s: number, r: any) => s + r.points, 0),
    };
  },

  async create(data: Record<string, unknown>) {
    return db.reward.create({ data: data as any });
  },
};
