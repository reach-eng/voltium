import { db } from '@/lib/db';
import { walletRepository } from './wallet.repository';
import { walletLedgerService } from './wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';
import { NotFoundError, ValidationError } from "@/lib/api-error";
import { Prisma } from '@prisma/client';

export async function reverseTransaction(transactionId: string, adminId: string, reason: string) {
  const txn = await walletRepository.findTransactionById(transactionId);
  if (!txn) throw new NotFoundError(`Transaction ${transactionId} not found`);
  if (txn.status !== 'APPROVED') {
    throw new ValidationError(`Cannot reverse transaction ${transactionId} — status is ${txn.status}`);
  }

  let result: any;
  await db.$transaction(async (tx: Prisma.TransactionClient) => {
    result = await walletLedgerService.reverse(
      {
        riderId: txn.riderId,
        originalTxnId: transactionId,
        originalAmount: txn.amount,
        originalType: txn.type as 'CREDIT' | 'DEBIT',
        actorId: adminId,
        reason,
      },
      tx
    );

    await tx.transaction.updateMany({
      where: { id: transactionId, status: 'APPROVED' },
      data: { status: 'REVERSED' },
    });
  });

  await createAuditLog({
    actorId: adminId,
    action: 'wallet.reverse',
    entity: 'transaction',
    entityId: transactionId,
    details: { riderId: txn.riderId, amountPaise: txn.amount, reason },
  });

  return result;
}
