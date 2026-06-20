import { db } from '@/lib/db';

export const teamLeaderRepository = {
  async findAllPaginated(params: {
    search?: string | null;
    isActive?: string | null;
    page: number;
    limit: number;
  }) {
    const { search, isActive, page, limit } = params;
    const where: any = {};
    if (isActive === 'ACTIVE') where.isActive = true;
    if (isActive === 'INACTIVE') where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [leaders, total] = await Promise.all([
      db.teamLeader.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.teamLeader.count({ where }),
    ]);

    const leaderIds = leaders.map((l: any) => l.id);
    const riderCountGroups: Array<{ teamLeader: string; _count: number }> =
      leaderIds.length > 0
        ? ((await db.rider.groupBy({
            by: ['teamLeader'],
            where: { teamLeader: { in: leaderIds, not: null } },
            _count: true,
          })) as unknown as Array<{ teamLeader: string; _count: number }>)
        : [];
    const riderCountMap = new Map(riderCountGroups.map((g: any) => [g.teamLeader, g._count]));

    const formatted = leaders.map((l: any) => ({
      ...l,
      riderCount: riderCountMap.get(l.id) || 0,
    }));

    return {
      leaders: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async create(data: Record<string, unknown>) {
    return db.teamLeader.create({ data: data as any });
  },

  async update(id: string, data: Record<string, unknown>) {
    return db.teamLeader.update({ where: { id }, data: data as any });
  },

  async delete(id: string) {
    return db.teamLeader.delete({ where: { id } });
  },

  async bulkActivate(ids: string[]) {
    const result = await db.teamLeader.updateMany({
      where: { id: { in: ids } },
      data: { isActive: true },
    });
    return result.count;
  },

  async bulkDeactivate(ids: string[]) {
    const result = await db.teamLeader.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });
    return result.count;
  },

  async bulkDelete(ids: string[]) {
    const result = await db.teamLeader.deleteMany({ where: { id: { in: ids } } });
    return result.count;
  },
};
