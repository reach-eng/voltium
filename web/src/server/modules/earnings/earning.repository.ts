import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';

export const earningRepository = {
  async findAllPaginated(params: {
    search?: string;
    platform?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }) {
    const { search, platform, startDate, endDate, page, limit } = params;
    const where: Prisma.RiderEarningWhereInput = {};

    if (search) {
      where.rider = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { riderId: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    if (platform && platform !== 'ALL') {
      where.platform = platform;
    }

    if (startDate || endDate) {
      where.date = {
        ...(startDate ? { gte: new Date(startDate) } : {}),
        ...(endDate ? { lte: new Date(`${endDate}T23:59:59.999Z`) } : {}),
      };
    }

    const [earnings, total, aggregate] = await Promise.all([
      db.riderEarning.findMany({
        where,
        orderBy: { date: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          date: true,
          platform: true,
          amountInPaise: true,
          trips: true,
          distance: true,
          hoursOnline: true,
          notes: true,
          createdAt: true,
          rider: { select: { id: true, riderId: true, fullName: true, phone: true } },
        },
      }),
      db.riderEarning.count({ where }),
      db.riderEarning.aggregate({
        where,
        _sum: { amountInPaise: true, trips: true },
        _avg: { amountInPaise: true },
      }),
    ]);

    // Typed sweep (2026-08-16): the schema column is `amountInPaise`.
    // Historical convention stores the rupee value in that column, and the
    // admin UI contract expects `amount` on each row — map it back so the
    // response shape is unchanged.
    const rows = earnings.map((e) => {
      const { amountInPaise, ...rest } = e;
      return { ...rest, amount: amountInPaise };
    });

    return {
      earnings: rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalAmount: aggregate._sum?.amountInPaise ?? 0,
        totalTrips: aggregate._sum?.trips ?? 0,
        averageAmount: aggregate._avg?.amountInPaise ?? 0,
      },
    };
  },

  async create(data: {
    riderId: string;
    date: Date;
    platform: string;
    amount: number;
    trips?: number;
    distance?: number;
    hoursOnline?: number;
    notes?: string;
  }) {
    return db.riderEarning.create({
      data: {
        riderId: data.riderId,
        date: data.date,
        platform: data.platform,
        // Typed sweep: schema column is `amountInPaise`; the input contract
        // keeps the rupee value (historical convention, see findAllPaginated).
        amountInPaise: data.amount,
        trips: data.trips ?? 0,
        distance: data.distance ?? 0,
        hoursOnline: data.hoursOnline ?? 0,
        notes: data.notes,
      },
    });
  },
};
