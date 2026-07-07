import { NextRequest } from 'next/server';
import { z } from 'zod';
import { success, errors } from '@/lib/api-response';
import { getAdminSession } from '@/lib/get-session';
import { hasPermission } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { db } from '@/lib/db';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { Prisma } from '@prisma/client';
import { createAuditLog } from '@/lib/audit-log';
import { randomUUID } from 'crypto';

const adjustSchema = z.object({
  amount: z.number().positive(),
  type: z.enum(['CREDIT', 'DEBIT']),
  reason: z.string().optional(),
  proofUrl: z.string().optional(),
});

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

  try {
    const body = await req.json();
    const validation = adjustSchema.safeParse(body);
    if (!validation.success) return errors.validation(validation.error.message);

    const { amount, type, reason, proofUrl } = validation.data;

    if (type === 'CREDIT' && !proofUrl) {
      return errors.badRequest('Proof URL is required for wallet top up (CREDIT)');
    }
    if (type === 'DEBIT' && !reason) {
      return errors.badRequest('Reason is required when deducting from wallet (DEBIT)');
    }

    const amountInPaise = Math.round(amount * 100);

    const result = await db.$transaction(async (tx: Prisma.TransactionClient) => {
      // Create a Transaction record for transparency
      const txn = await tx.transaction.create({
        data: {
          riderId: riderDbId,
          type,
          amount: amountInPaise,
          purpose: 'ADMIN_ADJUSTMENT',
          status: 'APPROVED',
          method: 'MANUAL',
          reason,
          proofUrl,
          description: `Admin manual ${type.toLowerCase()} of ₹${amount}`,
          approvedBy: session.adminId,
          approvedAt: new Date(),
          idempotencyKey: `admin-adjust:${riderDbId}:${randomUUID()}`,
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
      actorId: session.adminId!,
      actorType: 'ADMIN',
      action: 'wallet_adjustment',
      entity: 'wallet',
      entityId: riderDbId,
      details: JSON.stringify({ amount, type, reason }),
    }).catch(() => {});

    return success(result);
  } catch (error: any) {
    logger.error('Wallet adjust error:', error);
    return errors.internal(error.message || 'Failed to adjust wallet');
  }
}
