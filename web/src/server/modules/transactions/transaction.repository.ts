/**
 * Transactions module - Repository.
 *
 * Data access for transaction records, filters, and pagination.
 * All wallet mutations go through wallet-ledger.service — NOT here.
 */

import { db } from '@/lib/db';
import { paiseToRupees } from '@/lib/flatten-rider';
import { signRiderUrls } from '@/lib/sign-rider';
import { maskPhone } from '@/lib/pii';
import { Prisma, TransactionStatus, TransactionAudience } from '@prisma/client';
import { TransactionServiceError } from './transaction.service';
import type { TransactionFilter, TransactionListResult } from './transaction.types';

/**
 * H6-2026-08-13: audience filter union. 'ALL' means no filter
 * (admin-style full view); 'USER' or 'SYSTEM' restrict to one audience.
 * String-typed at the boundary so the route handler can pass raw
 * query-param values without a cast at every call site.
 */
export type AudienceFilter = TransactionAudience | 'ALL';

export const transactionRepository = {
  /**
   * Lists transactions with filters and pagination.
   * Returns amounts converted from paise to rupees.
   */
  async list(filters: TransactionFilter): Promise<TransactionListResult> {
    const {
      status,
      type,
      purpose,
      audience,
      search,
      startDate,
      endDate,
      riderId,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortDir = 'desc',
    } = filters;

    // P2-11/12 (financial audit): the filter object was built as
    // Record<string, unknown> with `as any` escapes that hid field/type drift.
    // Typed against Prisma.TransactionWhereInput so bad fields fail at compile
    // time instead of at query time.
    const where: Prisma.TransactionWhereInput = {};
    if (status) where.status = status as TransactionStatus;
    if (type) where.type = type as 'CREDIT' | 'DEBIT';
    if (purpose) where.purpose = purpose as Prisma.EnumTransactionPurposeFilter;
    // H6-2026-08-13: optional audience filter for admin screens that
    // need to drill into one audience.
    if (audience && audience !== 'ALL') {
      where.audience = audience as TransactionAudience;
    }
    if (riderId) where.riderId = riderId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }
    if (search) {
      where.rider = {
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

    const formatted = transactions.map((t) => ({
      ...t,
      // Typed sweep (2026-08-16): schema field is `amountInPaise` (Int,
      // non-null) — the old `?? t.amount` fallback read a nonexistent field
      // (silent `undefined`).
      amount: paiseToRupees(t.amountInPaise),
      rider: t.rider
        ? {
            ...t.rider,
            fullName: t.rider.fullName || t.rider.phone || t.rider.riderId || 'Unknown',
            // P2-17 (financial audit): admin-facing transaction lists must not
            // leak the full rider phone — mask to the last 4 digits. (Search
            // by phone still matches on the raw value server-side.)
            phone: maskPhone(t.rider.phone),
          }
        : null,
      breakdowns: (t.breakdowns || []).map((b) => ({
        ...b,
        amount: paiseToRupees(b.amountInPaise),
      })),
    }));

    const signed = await Promise.all(formatted.map((t) => signRiderUrls(t)));

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

  async findByRiderId(
    riderDbId: string,
    page = 1,
    limit = 20,
    // H6-2026-08-13: default to USER so the rider history endpoint
    // hides system flows (rent, rewards, reversals, etc.). Admin tools
    // pass 'ALL' to see everything.
    audience: AudienceFilter = 'USER'
  ) {
    const where: Prisma.TransactionWhereInput = { riderId: riderDbId };
    if (audience !== 'ALL') {
      where.audience = audience;
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { breakdowns: { orderBy: { sortOrder: 'asc' } } },
      }),
      db.transaction.count({ where }),
    ]);

    return {
      transactions: transactions.map((t) => ({
        ...t,
        amount: paiseToRupees(t.amountInPaise),
        breakdowns: (t.breakdowns || []).map((b) => ({
          ...b,
          amount: paiseToRupees(b.amountInPaise),
        })),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async deleteByRiderId(riderDbId: string) {
    return db.transaction.deleteMany({ where: { riderId: riderDbId } });
  },

  /**
   * CAS (compare-and-swap) status claim.
   *
   * P0-2 (financial audit): the old `update` blindly overwrote the status, so
   * two admins approving the same PENDING transaction both wrote APPROVED and
   * logged two audit entries with different adminIds. The `updateMany` now
   * requires `status` to still equal `expectedStatus`; the second writer
   * matches 0 rows and gets a CONFLICT, which the route serializes as 409.
   */
  async updateStatus(
    id: string,
    expectedStatus: TransactionStatus,
    status: TransactionStatus,
    approvedBy?: string,
    rejectionReason?: string
  ) {
    if (expectedStatus === status) {
      throw new TransactionServiceError(
        `Transaction is already in status "${status}". Cannot transition to same status.`,
        'CONFLICT'
      );
    }

    const claimed = await db.transaction.updateMany({
      where: { id, status: expectedStatus },
      data: {
        status,
        // P1-16/17 (financial audit): approvedAt must only be stamped on an
        // actual approval. The old code set it for REJECTED/REVERSED too (the
        // schema name lied), and never cleared it when a txn returned to
        // PENDING (REJECTED → PENDING re-submit). Now: APPROVED → now;
        // REVERSED/REFUNDED → untouched (keeps the original approval time);
        // PENDING/REJECTED/FAILED → cleared.
        approvedAt:
          status === TransactionStatus.APPROVED
            ? new Date()
            : status === TransactionStatus.REVERSED ||
                status === TransactionStatus.REFUNDED
              ? undefined
              : null,
        approvedBy: approvedBy || undefined,
        rejectionReason: rejectionReason || undefined,
      },
    });

    if (claimed.count === 0) {
      throw new TransactionServiceError(
        'Transaction was already processed by another admin',
        'CONFLICT'
      );
    }

    // Re-fetch so the caller gets the canonical post-claim row.
    const updated = await db.transaction.findUniqueOrThrow({ where: { id } });
    return updated;
  },
};
