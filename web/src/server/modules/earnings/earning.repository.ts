import { db } from '@/lib/db';

export const earningRepository = {
  async findAllPaginated(params: { search?: string; platform?: string; startDate?: string; endDate?: string; page: number; limit: number }) {
    const { search, platform, startDate, endDate, page, limit } = params;
    const where: Record<string, unknown> = {};

    if (search) {
      (where as any).rider = {
        OR: [{ fullName: { contains: search } }, { riderId: { contains: search } }],
      };
    }

    if (platform && platform !== 'ALL') {
      where.platform = platform;
    }

    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999Z`);
      (where as any).date = dateFilter;
    }

    const [earnings, total, aggregate] = await Promise.all([
      db.riderEarning.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, date: true, platform: true, amount: true, trips: true,
          distance: true, hoursOnline: true, notes: true, createdAt: true,
          rider: { select: { id: true, riderId: true, fullName: true, phone: true } },
        },
      }),
      db.riderEarning.count({ where }),
      db.riderEarning.aggregate({
        where,
        _sum: { amount: true, trips: true },
        _avg: { amount: true },
      }),
    ]);

    return {
      earnings,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalAmount: aggregate._sum.amount ?? 0,
        totalTrips: aggregate._sum.trips ?? 0,
        averageAmount: aggregate._avg.amount ?? 0,
      },
    };
  },
};
