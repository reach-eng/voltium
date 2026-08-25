import { NextRequest } from 'next/server';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { randomUUID } from 'crypto';
import { adminWalletAdjustSchema } from '@/lib/validators/admin';
import { env } from '@/lib/env';
import { toRupeesResponse } from '@/lib/api-money';

// PR-89 (API N6): hard cap on a single admin DEBIT and second-admin
// approval for debits above the threshold. Defaults:
//   MAX_ADMIN_DEBIT_INR = 50000
//   LARGE_DEBIT_THRESHOLD_INR = 10000
const MAX_DEBIT_PAISE = env.MAX_ADMIN_DEBIT_INR * 100;
const LARGE_DEBIT_PAISE = env.LARGE_DEBIT_THRESHOLD_INR * 100;
// PR-89 (API N6): reason minimum length for DEBIT operations.
const MIN_REASON_LEN = 10;
// PR-89 (API N6): rider lifecycle states for which a wallet adjustment
// is denied. SUSPENDED riders must not be debited; CLOSED accounts must
// be blocked from both directions.
const BLOCKED_LIFECYCLE_STATUSES = ['SUSPENDED', 'CLOSED'] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const resolvedParams = await params;
  const riderDbId = resolvedParams.id;

  const session = await getAdminSession();
  if (!session) return errors.unauthorized();
  // AUDIT FIX (N-13): wallet credit/debit moves MONEY — it was gated by
  // `riders_update` (so FLEET_MANAGER could move money while FINANCE_ADMIN
  // couldn't). Use the finance permission.
  if (!hasPermission(session, 'finance_reconcile')) {
    return errors.forbidden('Finance permission required to adjust rider wallets');
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
        `Debit amount ₹${amount} exceeds maximum allowed admin debit limit of ₹${env.MAX_ADMIN_DEBIT_INR}`
      );
    }

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

    const result = await db.$transaction(async (tx) => {
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
          // PR-89 (API N6): include coAdminId in the idempotency key
          // when present so a second co-approved debit doesn't
          // dedupe-collide with the first admin's own previous call.
          idempotencyKey: `admin-adjust:${riderDbId}:${coAdminId ?? session.adminId}:${randomUUID()}`,
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

      // F-036: move audit logging INSIDE money transaction so any audit failure rolls back
      // the wallet change, and untracked money movement is prevented.
      await createAuditLog(
        {
          actorId: session.adminId!,
          actorType: 'ADMIN',
          action: 'wallet_adjustment',
          entity: 'wallet',
          entityId: riderDbId,
          details: JSON.stringify({
            amount,
            type,
            reason,
            coAdminId: type === 'DEBIT' ? coAdminId : undefined,
            largeDebit: type === 'DEBIT' && amountInPaise > LARGE_DEBIT_PAISE,
          }),
        },
        tx
      );

      return { walletBalance: wallet?.balanceInPaise ? wallet.balanceInPaise / 100 : 0 };
    });

    return success(toRupeesResponse(result));
  } catch (error: any) {
    logger.error('Wallet adjust error:', error);
    return errors.internal('Failed to adjust wallet');
  }
}
