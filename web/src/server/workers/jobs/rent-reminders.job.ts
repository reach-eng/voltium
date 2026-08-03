import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { notificationService } from '@/lib/notification-service';
import { OutboxService, OutboxEventTypes } from '../outbox';
import { walletLedgerService } from '@/server/modules/wallet/wallet-ledger.service';
import { createAuditLog } from '@/lib/audit-log';
import { clock } from '@/lib/clock';

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

    // Find active rentals that are due or overdue.
    // PR-76: filter on `nextRentDueAt <= now()` so each lease is
    // debited once per period (not once per day). The previous
    // filter was `leaseDate <= today` which matched a 7-day
    // tenant every day and drained the wallet in 1-2 days.
    const now = clock.now();

    const activeLeases = (await db.rentalLease.findMany({
      where: {
        status: 'BOOKED',
        nextRentDueAt: { lte: now },
        rider: {
          lifecycleStatus: 'ACTIVE',
          wallet: { balanceInPaise: { gte: 0 } },
        },
      },
      select: {
        id: true,
        riderId: true,
        finalPriceInPaise: true,
        periodNo: true,
        nextRentDueAt: true,
        // Look up the plan's durationDays to advance nextRentDueAt
        // by the right amount after a successful debit.
        rider: {
          select: {
            id: true,
            currentPlanRef: { select: { durationDays: true } },
            wallet: { select: { balanceInPaise: true } },
          },
        },
      },
    })) as any;

    result.checkedRentals = activeLeases.length;

    for (const lease of activeLeases) {
      const rider = lease.rider;
      const rentAmount = lease.finalPriceInPaise;
      const balance = rider.wallet?.balanceInPaise ?? 0;
      // Default to 1 day if plan ref is missing (legacy data)
      const durationDays = rider.currentPlanRef?.durationDays ?? 1;

      if (balance >= rentAmount) {
        // Auto-debit: sufficient balance
        try {
          // PR-76: idempotency key is per-period, not per-day.
          // The previous `rent:{lease.id}:{today}` key was unique
          // per day, so a 7-day tenant was charged 7 times.
          const periodKey = `rent:${lease.id}:period:${lease.periodNo}`;
          const newPeriodNo = lease.periodNo + 1;
          const newNextRentDueAt = new Date(
            lease.nextRentDueAt!.getTime() + durationDays * 24 * 60 * 60 * 1000
          );

          await db.$transaction(async (tx: any) => {
            // Re-check inside tx: another worker may have already
            // advanced this lease. If periodNo changed, skip.
            const fresh = await tx.rentalLease.findUnique({
              where: { id: lease.id },
              select: { periodNo: true, nextRentDueAt: true },
            });
            if (!fresh || fresh.periodNo !== lease.periodNo) {
              throw new Error('LEASE_PERIOD_ADVANCED');
            }

            const txn = await tx.transaction.create({
              data: {
                riderId: rider.id,
                type: 'DEBIT',
                amountInPaise: rentAmount,
                purpose: 'RENT_PAYMENT',
                status: 'APPROVED',
                approvedAt: clock.now(),
                description: `Auto-debit rent period ${lease.periodNo} for lease ${lease.id}`,
                idempotencyKey: periodKey,
              },
            });

            await walletLedgerService.debit({
              riderId: rider.id,
              amountInPaise: rentAmount,
              category: 'RENT_PAYMENT',
              txnId: txn.id,
              idempotencyKey: periodKey,
              note: `Auto-debit rent period ${lease.periodNo} for lease ${lease.id}`,
            }, tx);

            // Advance the lease to the next period. This MUST be
            // in the same tx as the debit so a crash mid-way doesn't
            // leave the lease stuck on a period.
            await tx.rentalLease.update({
              where: { id: lease.id },
              data: {
                periodNo: newPeriodNo,
                lastPaidAt: clock.now(),
                nextRentDueAt: newNextRentDueAt,
              },
            });
          });

          createAuditLog({
            actorId: 'system',
            action: 'CREATE',
            entity: 'rentalLease',
            entityId: lease.id,
            details: {
              riderId: rider.id,
              amountPaise: rentAmount,
              periodNo: lease.periodNo,
              durationDays,
            },
          }).catch(() => {});

          result.autoDebited++;

          // Send payment receipt notification
          await notificationService
            .notifyPaymentReminder(rider.id, rentAmount, 'payment_receipt')
            .catch(() => {});
          result.notificationsSent++;
        } catch (err) {
          // Concurrent worker won the race; not a real failure.
          if (err instanceof Error && err.message === 'LEASE_PERIOD_ADVANCED') {
            logger.debug('[RentRemindersJob] Lease period already advanced, skipping', {
              leaseId: lease.id,
            });
            continue;
          }
          logger.error('[RentRemindersJob] Auto-debit failed', { riderId: rider.id, err });
        }
      } else {
        // Insufficient balance — mark as potential overdue
        result.overdueDetected++;

        // Emit outbox event for overdue
        // PR-75: rent overdue is rider-visible; classify as
        // interactive so the (currently-unwired) consumer of
        // RENT_OVERDUE doesn't get starved by background work.
        await OutboxService.emit(
          OutboxEventTypes.RENT_OVERDUE,
          {
            riderId: rider.id,
            leaseId: lease.id,
            amountDue: rentAmount,
            balance,
          },
          3,
          undefined,
          'interactive'
        ).catch(() => {});

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
