/**
 * Transactions module - Repository.
 *
 * Data access for transaction records, filters, and pagination.
 * All wallet mutations go through wallet-ledger.service — NOT here.
 */

import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { signRiderUrls } from '@/lib/sign-rider';
import type { TransactionFilter, TransactionListResult } from './transaction.types';

export const transactionRepository = {
  /**
   * Lists transactions with filters and pagination.
   * Returns amounts converted from paise to rupees.
   */
  async list(filters: TransactionFilter): Promise<TransactionListResult> {
    const {
      status,
      type,
      search,
      startDate,
      endDate,
      riderId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = filters;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (riderId) where.riderId = riderId;
    if (startDate || endDate) {
      (where as any).createdAt = {};
      if (startDate) (where as any).createdAt.gte = new Date(startDate);
      if (endDate) (where as any).createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (search) {
      (where as any).rider = {
        OR: [
          { fullName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
          { riderId: { contains: search, mode: 'insensitive' } },
        ],
      };
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        include: {
          rider: {
            select: { id: true, riderId: true, fullName: true, phone: true },
          },
          breakdowns: true,
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.transaction.count({ where }),
    ]);

    const formatted = transactions.map((t: any) => ({
      ...t,
      amount: paiseToRupees(t.amount),
      rider: t.rider
        ? {
            ...t.rider,
            fullName: t.rider.fullName || t.rider.phone || t.rider.riderId || 'Unknown',
          }
        : null,
      breakdowns: (t.breakdowns || []).map((b: any) => ({
        ...b,
        amount: paiseToRupees(b.amount),
      })),
    }));

    const signed = await Promise.all(formatted.map((t: any) => signRiderUrls(t)));

    return {
      transactions: signed,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  async findById(id: string) {
    return db.transaction.findUnique({
      where: { id },
      include: {
        rider: { select: { id: true, riderId: true, fullName: true, phone: true } },
        breakdowns: true,
      },
    });
  },

  async findByRiderId(riderDbId: string, page = 1, limit = 20) {
    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where: { riderId: riderDbId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { breakdowns: { orderBy: { sortOrder: 'asc' } } },
      }),
      db.transaction.count({ where: { riderId: riderDbId } }),
    ]);

    return {
      transactions: transactions.map((t: any) => ({
        ...t,
        amount: paiseToRupees(t.amount),
        breakdowns: (t.breakdowns || []).map((b: any) => ({
          ...b,
          amount: paiseToRupees(b.amount),
        })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async deleteByRiderId(riderDbId: string) {
    return db.transaction.deleteMany({ where: { riderId: riderDbId } });
  },

  async updateStatus(id: string, status: string, approvedBy?: string, rejectionReason?: string) {
    return db.transaction.update({
      where: { id },
      data: {
        status,
        approvedAt: ['APPROVED', 'REJECTED', 'REVERSED'].includes(status) ? new Date() : undefined,
        approvedBy: approvedBy || undefined,
        rejectionReason: rejectionReason || undefined,
      },
    });
  },
};
