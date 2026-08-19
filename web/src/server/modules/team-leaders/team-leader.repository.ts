import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const teamLeaderRepository = {
  async findAllPaginated(params: {
    search?: string | null;
    isActive?: string | null;
    hubId?: string | null;
    page: number;
    limit: number;
  }) {
    const { search, isActive, hubId, page, limit } = params;
    const where: Prisma.TeamLeaderWhereInput = { deletedAt: null };
    if (isActive === 'ACTIVE') where.isActive = true;
    if (isActive === 'INACTIVE') where.isActive = false;
    if (hubId && hubId !== 'ALL') where.hubId = hubId;
    if (search) {
      const trimmed = search.trim();
      where.OR = [
        { name: { contains: trimmed, mode: 'insensitive' } },
        { phone: { contains: trimmed, mode: 'insensitive' } },
        { email: { contains: trimmed, mode: 'insensitive' } },
        { hub: { name: { contains: trimmed, mode: 'insensitive' } } },
      ];
    }

    const [leaders, total] = await Promise.all([
      db.teamLeader.findMany({
        where,
        include: {
          hub: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.teamLeader.count({ where }),
    ]);

    const leaderIds = leaders.map((l) => l.id);
    const riderCountGroups: Array<{ teamLeaderId: string; _count: number }> =
      leaderIds.length > 0
        ? ((await db.rider.groupBy({
            by: ['teamLeaderId'],
            where: { teamLeaderId: { in: leaderIds, not: null } },
            _count: true,
          })) as unknown as Array<{ teamLeaderId: string; _count: number }>)
        : [];
    const riderCountMap = new Map(riderCountGroups.map((g) => [g.teamLeaderId, g._count]));

    const formatted = leaders.map((l) => ({
      ...l,
      riderCount: riderCountMap.get(l.id) || 0,
    }));

    return {
      leaders: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async findById(id: string) {
    return db.teamLeader.findUnique({ where: { id } });
  },

  async create(data: Prisma.TeamLeaderCreateInput) {
    return db.teamLeader.create({ data });
  },

  async update(id: string, data: Prisma.TeamLeaderUpdateInput) {
    return db.teamLeader.update({ where: { id }, data });
  },

  async delete(id: string) {
    return db.teamLeader.update({ 
      where: { id }, 
      data: { isActive: false, deletedAt: new Date() } 
    });
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
    const result = await db.teamLeader.updateMany({ 
      where: { id: { in: ids } },
      data: { isActive: false, deletedAt: new Date() }
    });
    return result.count;
  },
};
