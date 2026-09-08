import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { adminWalletAdjustSchema } from '@/lib/validators/admin';
import { env } from '@/lib/env';
import { toRupeesResponse } from '@/lib/api-money';

// PR-89 (API N6): hard cap on a single admin DEBIT and second-admin
// approval for debits above the threshold. Defaults:
//   MAX_ADMIN_DEBIT_INR = 50000
//   LARGE_DEBIT_THRESHOLD_INR = 10000
// AUDIT-RECON 2026-09-02 batch 5 P0-1: per-day aggregate cap on a
// single admin's DEBITs. The per-call cap + co-approval gate stop any
// single large debit, but a determined admin could still issue
// unlimited back-to-back ₹50k debits as long as each is under the
// per-call cap. The aggregate cap (default ₹2,00,000/day) puts a
// ceiling on cumulative daily drain per admin.
const MAX_DEBIT_PAISE = env.MAX_ADMIN_DEBIT_INR * 100;
const LARGE_DEBIT_PAISE = env.LARGE_DEBIT_THRESHOLD_INR * 100;
const MAX_DEBIT_PER_DAY_PAISE = env.MAX_ADMIN_DEBIT_PER_DAY_INR * 100;
// PR-89 (API N6): reason minimum length for DEBIT operations.
const MIN_REASON_LEN = 10;
// PR-89 (API N6): rider lifecycle states for which a wallet adjustment
// is denied. SUSPENDED riders must not be debited; CLOSED accounts must
// be blocked from both directions.
const BLOCKED_LIFECYCLE_STATUSES = ['SUSPENDED', 'CLOSED'] as const;

/**
 * NET-005 follow-up-22 (2026-09-08): typed error
 * for the daily-debit cap. The route's catch
 * block maps this to a 400 (the cap is a
 * per-day ceiling, not a server-internal
 * failure). A plain `Error` would be caught by
 * the generic 500 fallback.
 */
class DailyDebitCapExceededError extends Error {
  constructor(
    public readonly todayPaise: number,
    public readonly attemptedPaise: number,
    public readonly capPaise: number
  ) {
    super(
      `Daily admin debit cap exceeded. Today: ₹${(todayPaise / 100).toFixed(2)} + this request ₹${(attemptedPaise / 100).toFixed(2)} > max ₹${(capPaise / 100).toFixed(0)} per day.`
    );
    this.name = 'DailyDebitCapExceededError';
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const riderDbId = resolvedParams.id;

  const session = await getAdminSession();
  if (!session) return errors.unauthorized();
  if (!hasPermission(session, 'riders_update')) {
    return errors.forbidden('Insufficient permissions');
  }
  // NET-005 follow-up-22 (2026-09-08): the
  // pre-fix code passed `session.adminId`
  // straight to the daily-cap aggregate
  // (`where: { approvedBy: session.adminId }`)
  // and the audit log (`actorId: session.adminId!`
  // non-null assertion). The session shape is
  // `adminId?: string` — it can be undefined.
  // Prisma's `where: { field: undefined }`
  // drops the filter (NOT match-nothing), so the
  // aggregate would silently sum EVERY admin's
  // debits, and the audit log's non-null
  // assertion would explode at runtime. Refuse
  // the request at the top of the route —
  // a session without an actorId can't
  // attribute destructive operations. Same
  // pattern as the soft-delete fix
  // (followup-18) and the bulk-delete fix
  // (followup-18).
  if (!session.adminId) {
    return errors.unauthorized('Admin session has no actor id');
  }

  try {
    const body = await req.json();
    const validation = adminWalletAdjustSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { amount, type, reason, proofUrl, coAdminId } = validation.data;

    if (type === 'CREDIT' && !proofUrl) {
      return errors.badRequest('Proof URL is required for wallet top up (CREDIT)');
    }
    if (type === 'DEBIT' && !reason) {
      return errors.badRequest('Reason is required when deducting from wallet (DEBIT)');
    }
    if (type === 'DEBIT' && reason && reason.trim().length < MIN_REASON_LEN) {
      return errors.badRequest(
        `Reason must be at least ${MIN_REASON_LEN} characters for a DEBIT operation`
      );
    }

    const amountInPaise = Math.round(amount * 100);

    // PR-89 (API N6): accountStatus gate — reject adjustments for riders
    // whose lifecycle status is in the blocklist. Read once up-front to
    // avoid racing the transaction.
    const rider = await db.rider.findUnique({
      where: { id: riderDbId },
      select: { id: true, lifecycleStatus: true, deletedAt: true },
    });
    if (!rider || rider.deletedAt) {
      return errors.notFound('Rider not found');
    }
    if (BLOCKED_LIFECYCLE_STATUSES.includes(rider.lifecycleStatus as typeof BLOCKED_LIFECYCLE_STATUSES[number])) {
      return errors.forbidden(
        `Cannot adjust wallet for a rider in lifecycle status ${rider.lifecycleStatus}`
      );
    }

    // PR-89 (API N6): per-call cap. A single admin cannot drain a
    // wallet beyond MAX_ADMIN_DEBIT_INR in one request.
    if (type === 'DEBIT' && amountInPaise > MAX_DEBIT_PAISE) {
      return errors.badRequest(
        `Debit amount ₹${amount} exceeds maximum allowed admin debit limit of ₹${env.MAX_ADMIN_DEBIT_INR}`,
      );
    }

    // AUDIT-RECON 2026-09-02 batch 5 P0-1: per-day
    // aggregate cap. The aggregate check moved
    // INSIDE the transaction below (and now
    // includes a `SELECT ... FOR UPDATE` row
    // lock on the admin) so concurrent debits
    // by the same admin serialize — the pre-fix
    // version was a read-then-act: the aggregate
    // ran OUTSIDE the tx, two concurrent requests
    // both read the same snapshot, both passed
    // the cap check, both wrote. UTC midnight
    // keeps the day boundary deterministic
    // regardless of server timezone.

    // PR-89 (API N6): for amounts above the threshold, require a

    // PR-89 (API N6): for amounts above the threshold, require a
    // second active admin to co-approve. The co-admin id must exist
    // and be active. This prevents a single rogue admin from
    // approving arbitrarily large debits.
    if (type === 'DEBIT' && amountInPaise > LARGE_DEBIT_PAISE) {
      if (!coAdminId) {
        return errors.badRequest(
          `Debits above ₹${env.LARGE_DEBIT_THRESHOLD_INR} require a coAdminId for second-admin approval`
        );
      }
      if (coAdminId === session.adminId) {
        return errors.badRequest('coAdminId must differ from the acting admin');
      }
      const coAdmin = await db.admin.findUnique({
        where: { id: coAdminId },
        select: { id: true, isActive: true },
      });
      if (!coAdmin || !coAdmin.isActive) {
        return errors.forbidden('coAdminId does not refer to an active admin');
      }
    }

    // F-22: Deterministic idempotency key for retries.
    // Client can provide an explicit key via header or body; fallback to a 5-minute bucketed key.
    const clientKey = req.headers.get('x-idempotency-key') || validation.data.idempotencyKey;
    const bucket = Math.floor(Date.now() / (5 * 60 * 1000));
    const idempotencyKey = clientKey
      ? `admin-adjust:${riderDbId}:${coAdminId ?? session.adminId}:${clientKey}`
      : `admin-adjust:${riderDbId}:${coAdminId ?? session.adminId}:${type}:${amountInPaise}:${bucket}`;

    // Deduplicate retries with the same idempotency key
    const existingTxn = await db.transaction.findUnique({
      where: { idempotencyKey },
    });
    if (existingTxn) {
      logger.info('[AdminWalletAdjust] Duplicate idempotencyKey detected, returning existing balance', {
        idempotencyKey,
        txnId: existingTxn.id,
      });
      const wallet = await db.wallet.findUnique({
        where: { riderId: riderDbId },
        select: { balanceInPaise: true },
      });
      const result = {
        walletBalance: wallet?.balanceInPaise ? wallet.balanceInPaise / 100 : 0,
      };
      return success(toRupeesResponse(result));
    }

    const result = await db.$transaction(async (tx) => {
      // NET-005 follow-up-22 (2026-09-08):
      // Row-lock the admin row so concurrent
      // debits by the same admin serialize. The
      // lock is per-admin (other admins' debits
      // are not blocked). The aggregate that
      // follows is then authoritative — under
      // READ COMMITTED (Prisma's default), the
      // FOR UPDATE blocks the second concurrent
      // transaction until the first commits,
      // so the second sees the first's debit
      // in its aggregate. The pre-fix code did
      // the aggregate outside the tx; two
      // concurrent requests both read the same
      // snapshot, both passed the cap, both
      // wrote — exceeding the daily ceiling.
      //
      // `approvedBy` is indexed (see
      // prisma/migrations/* approvedBy_index).
      // The lock is on the Admin row, not the
      // transaction aggregate, because the
      // aggregate is virtual — locking the
      // admin serializes the read-modify-write
      // cycle for the daily-cap invariant.
      if (type === 'DEBIT') {
        await tx.$executeRaw`SELECT id FROM "Admin" WHERE id = ${session.adminId} FOR UPDATE`;
        const now = new Date();
        const todayUtcMidnight = new Date(
          Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
        );
        const todayAggregate = await tx.transaction.aggregate({
          where: {
            approvedBy: session.adminId,
            type: 'DEBIT',
            status: 'APPROVED',
            createdAt: { gte: todayUtcMidnight },
          },
          _sum: { amountInPaise: true },
        });
        const todayDebitPaise = todayAggregate._sum.amountInPaise ?? 0;
        if (todayDebitPaise + amountInPaise > MAX_DEBIT_PER_DAY_PAISE) {
          throw new DailyDebitCapExceededError(
            todayDebitPaise,
            amountInPaise,
            MAX_DEBIT_PER_DAY_PAISE,
          );
        }
      }

      // Create a Transaction record for transparency
      const txn = await tx.transaction.create({
        data: {
          riderId: riderDbId,
          type,
          amountInPaise,
          purpose: 'ADMIN_ADJUSTMENT',
          status: 'APPROVED',
          method: 'MANUAL',
          reason,
          proofUrl,
          description: `Admin manual ${type.toLowerCase()} of ₹${amount}`,
          approvedBy: session.adminId,
          approvedAt: new Date(),
          // F-22: Store deterministic idempotencyKey without randomUUID()
          // so retries properly deduplicate.
          idempotencyKey,
        },
      });

      // Update the ledger and wallet balance
      if (type === 'CREDIT') {
        await walletLedgerService.credit({
          riderId: riderDbId,
          amountInPaise,
          category: 'ADMIN_ADJUSTMENT',
          actorId: session.adminId,
          txnId: txn.id,
          idempotencyKey: `ledger-credit:${txn.id}`,
          note: reason || 'Manual credit by admin',
        }, tx);
      } else {
        await walletLedgerService.debit({
          riderId: riderDbId,
          amountInPaise,
          category: 'ADMIN_ADJUSTMENT',
          actorId: session.adminId,
          txnId: txn.id,
          idempotencyKey: `ledger-debit:${txn.id}`,
          note: reason || 'Manual debit by admin',
          allowNegative: true, // Admin can force negative balance for late fees
        }, tx);
      }

      const wallet = await tx.wallet.findUnique({
        where: { riderId: riderDbId },
        select: { balanceInPaise: true },
      });

      return { walletBalance: wallet?.balanceInPaise ? wallet.balanceInPaise / 100 : 0 };
    });

    createAuditLog({
      // NET-005 follow-up-22 (2026-09-08):
      // the top-of-route adminId guard
      // guarantees this is a string — the
      // pre-fix `!` non-null assertion was
      // load-bearing against an
      // undefined-value crash.
      actorId: session.adminId,
      actorType: 'ADMIN',
      action: 'wallet.adjustment',
      entity: 'wallet',
      entityId: riderDbId,
      details: JSON.stringify({
        amount,
        type,
        reason,
        coAdminId: type === 'DEBIT' ? coAdminId : undefined,
        largeDebit: type === 'DEBIT' && amountInPaise > LARGE_DEBIT_PAISE,
      }),
    }).catch(() => {});

    return success(toRupeesResponse(result));
  } catch (error: any) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      logger.info('[AdminWalletAdjust] Caught P2002 duplicate idempotencyKey race, returning existing balance');
      const wallet = await db.wallet.findUnique({
        where: { riderId: riderDbId },
        select: { balanceInPaise: true },
      });
      const result = {
        walletBalance: wallet?.balanceInPaise ? wallet.balanceInPaise / 100 : 0,
      };
      return success(toRupeesResponse(result));
    }
    // NET-005 follow-up-22 (2026-09-08): the
    // daily-cap throw (inside the tx) is
    // mapped to 400 — the cap is a per-day
    // ceiling, not a server-internal failure.
    // The pre-fix version did the cap check
    // pre-tx and returned 400 directly; the
    // in-tx version throws a typed error so
    // the transaction can roll back cleanly.
    if (error instanceof DailyDebitCapExceededError) {
      return errors.badRequest(error.message);
    }
    logger.error('Wallet adjust error:', error);
    return errors.internal('Failed to adjust wallet');
  }
}
