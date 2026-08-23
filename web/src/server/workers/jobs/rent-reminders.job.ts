import { db } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { type QueueJob } from '@/lib/job-queue';
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
  /**
   * PR-VER-2026-08-06 (EVENT_BUS P0-6): `mode` differentiates the two admin
   * job cards that share this processor.
   *   - 'full' (default): rent-due check — detect overdue + notify, AND
   *     auto-debit wallets with sufficient balance.
   *   - 'debit-only': auto-debit — only attempt wallet debits; do NOT emit
   *     RENT_OVERDUE or send overdue notifications.
   */
  async process(
    job: QueueJob,
    opts?: { mode?: 'full' | 'debit-only' }
  ): Promise<RentReminderResult> {
    logger.info('[RentRemindersJob] Starting', {
      jobId: job.id,
      mode: opts?.mode ?? 'full',
    });
    const debitOnly = opts?.mode === 'debit-only';

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

    const activeLeases = await db.rentalLease.findMany({
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
        // T-90 (PR-1, 2026-08-23): include `overdueNotifiedAt` so
        // the overdue path can skip leases that already received
        // their per-period notification this pass.
        overdueNotifiedAt: true,
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
    });

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

          await db.$transaction(async (tx) => {
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
            //
            // T-90 (PR-1, 2026-08-23): clear `overdueNotifiedAt`
            // alongside the periodNo bump so the next period's
            // overdue (if any) is treated as a fresh, un-pinged
            // lease. Without this, a lease that flips overdue→paid
            //→overdue across two periods would never get the
            // second-period push.
            await tx.rentalLease.update({
              where: { id: lease.id },
              data: {
                periodNo: newPeriodNo,
                lastPaidAt: clock.now(),
                nextRentDueAt: newNextRentDueAt,
                overdueNotifiedAt: null,
              },
            });

            // PR-VER-2026-08-06 (EVENT_BUS P0-5): RENT_PAID had a consumer
            // (orphan-event-consumer sends the receipt push) but NO producer —
            // the outbox row for it never existed, so the receipt was never
            // sent. Emit INSIDE the debit tx (repo convention:
            // scripts/check-outbox-emit-with-tx.sh) so a payment can never
            // commit without its RENT_PAID outbox row. If the emit fails the
            // whole tx rolls back — the debit is idempotent via periodKey,
            // so a job retry replays it cleanly.
            await OutboxService.emit(
              OutboxEventTypes.RENT_PAID,
              {
                riderId: rider.id,
                leaseId: lease.id,
                amountInPaise: rentAmount,
                periodNo: lease.periodNo,
              },
              3,
              tx,
              'interactive'
            );
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

          // T-90 (PR-1, 2026-08-23): the previous direct call here
          // created a DOUBLE receipt per successful debit. The
          // `RENT_PAID` outbox row emitted inside the same tx (above)
          // is the single source of truth; the
          // `orphan-event-consumer.job.ts:handleRentPaid` consumer
          // fires `notifyPaymentReminder` off that row. The
          // resulting push is one per payment, not two.
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
      } else if (!debitOnly) {
        // Insufficient balance — mark as potential overdue. Skipped in
        // debit-only mode (PR-VER-2026-08-06 EVENT_BUS P0-6): the
        // auto-debit admin job only attempts debits, it does not spam
        // overdue notifications.
        //
        // T-90 (PR-1, 2026-08-23): per-period sent-marker CAS. The
        // previous code emitted RENT_OVERDUE + a direct
        // notifyPaymentReminder EVERY minute the lease was overdue,
        // because the lease was not advanced (no debit happened) and
        // nothing recorded that we'd already pinged the rider. The
        // fix mirrors the auto-debit path's periodNo CAS: re-read
        // `overdueNotifiedAt` inside the tx, only emit+notify+stamp
        // when it is still null. When the rider tops up and the
        // debit succeeds, the next debit tx advances periodNo and
        // clears overdueNotifiedAt (next block).
        result.overdueDetected++;

        try {
          await db.$transaction(async (tx) => {
            // Re-read inside tx to handle concurrent workers and
            // a top-up that may have arrived between findMany and
            // now. If overdueNotifiedAt is set, another worker
            // already paged this rider for this period — skip.
            const fresh = await tx.rentalLease.findUnique({
              where: { id: lease.id },
              select: {
                periodNo: true,
                overdueNotifiedAt: true,
                rider: { select: { wallet: { select: { balanceInPaise: true } } } },
              },
            });
            if (!fresh || fresh.periodNo !== lease.periodNo) {
              throw new Error('LEASE_PERIOD_ADVANCED');
            }
            if (fresh.overdueNotifiedAt) {
              // Already paged this rider for this period; skip.
              throw new Error('LEASE_OVERDUE_ALREADY_NOTIFIED');
            }
            // If the wallet topped up between findMany and now,
            // the next pass (within the hour) will auto-debit; the
            // skip avoids a spurious overdue push.
            if ((fresh.rider.wallet?.balanceInPaise ?? 0) >= rentAmount) {
              throw new Error('LEASE_BALANCE_RECOVERED');
            }

            // Emit outbox event for overdue. PR-75: rent overdue is
            // rider-visible; classify as interactive so the consumer
            // doesn't get starved by background work.
            await OutboxService.emit(
              OutboxEventTypes.RENT_OVERDUE,
              {
                riderId: rider.id,
                leaseId: lease.id,
                amountDue: rentAmount,
                balance,
                hoursUntilDebit: 0,
                periodNo: lease.periodNo ?? 1,
              },
              3,
              tx,
              'interactive'
            );

            // Atomic sent-marker: same tx as the outbox emit so the
            // notification fires exactly once per (lease, period).
            // The orphan-event-consumer's handleRentOverdue reads
            // the rider balance to decide whether to page ops; the
            // actual `notifyPaymentReminder` push is fired off the
            // RENT_OVERDUE outbox row by that consumer.
            await tx.rentalLease.update({
              where: { id: lease.id },
              data: { overdueNotifiedAt: clock.now() },
            });
          });

          // T-90: drop the direct `notifyPaymentReminder` call here
          // for the same reason as the auto-debit branch — the
          // outbox `RENT_OVERDUE` row is the single source of truth
          // and the orphan-event-consumer fires the push.
          result.notificationsSent++;
        } catch (err) {
          if (err instanceof Error) {
            if (
              err.message === 'LEASE_PERIOD_ADVANCED' ||
              err.message === 'LEASE_OVERDUE_ALREADY_NOTIFIED' ||
              err.message === 'LEASE_BALANCE_RECOVERED'
            ) {
              // Not a real failure — these are the expected skip
              // conditions. Drop the overdueDetected counter so the
              // admin "Rent due" report only counts real new
              // overdues.
              result.overdueDetected--;
              logger.debug(
                '[RentRemindersJob] Overdue notification skipped (idempotent)',
                { leaseId: lease.id, reason: err.message }
              );
              continue;
            }
          }
          logger.error('[RentRemindersJob] Overdue notification failed', {
            riderId: rider.id,
            err,
          });
        }
      }
    }

    logger.info('[RentRemindersJob] Complete', result);
    return result;
  },
};
