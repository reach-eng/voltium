import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { notificationService } from '@/lib/notification-service';
import { OutboxService, OutboxEventTypes } from '../outbox';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';

interface RentReminderResult {
  checkedRentals: number;
  overdueDetected: number;
  autoDebited: number;
  notificationsSent: number;
}

export const rentRemindersJob = {
  async process(job: any): Promise<RentReminderResult> {
    logger.info('[RentRemindersJob] Starting', { jobId: job.id });

    const result: RentReminderResult = {
      checkedRentals: 0,
      overdueDetected: 0,
      autoDebited: 0,
      notificationsSent: 0,
    };

    // Find active rentals that are due or overdue
    // Uses the RentalLease model to find active riders with active leases
    const today = new Date().toISOString().split('T')[0];

    const activeLeases = (await db.rentalLease.findMany({
      where: {
        status: 'BOOKED',
        leaseDate: { lte: today },
        rider: {
          lifecycleStatus: 'ACTIVE',
          wallet: { balanceInPaise: { gte: 0 } },
        },
      },
      select: {
        id: true,
        riderId: true,
        finalPrice: true,
        rider: {
          include: {
            wallet: true,
          },
        },
      },
    })) as any;

    result.checkedRentals = activeLeases.length;

    for (const lease of activeLeases) {
      const rider = lease.rider;
      const rentAmount = lease.finalPrice;
      const balance = rider.wallet?.balanceInPaise ?? 0;

      if (balance >= rentAmount) {
        // Auto-debit: sufficient balance
        try {
          // Create a DEBIT transaction for rent payment
          const idempotencyKey = `rent:${lease.id}:${today}`;

          await db.$transaction(async (tx: any) => {
            const txn = await tx.transaction.create({
              data: {
                riderId: rider.id,
                type: 'DEBIT',
                amount: rentAmount,
                purpose: 'RENT_PAYMENT',
                status: 'APPROVED',
                approvedAt: new Date(),
                description: `Auto-debit rent for lease ${lease.id}`,
              },
            });

            await walletLedgerService.debit({
              riderId: rider.id,
              amountInPaise: rentAmount,
              category: 'RENT_PAYMENT',
              txnId: txn.id,
              idempotencyKey,
              note: `Auto-debit rent payment for lease ${lease.id}`,
            });
          });

          createAuditLog({
            actorId: 'system',
            action: 'finance.rent_debit',
            entity: 'rentalLease',
            entityId: lease.id,
            details: { riderId: rider.id, amountPaise: rentAmount },
          }).catch(() => {});

          result.autoDebited++;

          // Send payment receipt notification
          await notificationService
            .notifyPaymentReminder(rider.id, rentAmount, 'payment_receipt')
            .catch(() => {});
          result.notificationsSent++;
        } catch (err) {
          logger.error('[RentRemindersJob] Auto-debit failed', { riderId: rider.id, err });
        }
      } else {
        // Insufficient balance — mark as potential overdue
        result.overdueDetected++;

        // Emit outbox event for overdue
        await OutboxService.emit(OutboxEventTypes.RENT_OVERDUE, {
          riderId: rider.id,
          leaseId: lease.id,
          amountDue: rentAmount,
          balance,
        }).catch(() => {});

        // Send overdue notification
        await notificationService
          .notifyPaymentReminder(rider.id, rentAmount, 'overdue')
          .catch(() => {});
        result.notificationsSent++;
      }
    }

    logger.info('[RentRemindersJob] Complete', result);
    return result;
  },
};
