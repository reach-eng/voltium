/**
 * Deposits module - Use cases.
 *
 * Orchestrates deposit submission, approval, rejection, refund, and forfeit workflows.
 * Delegates to deposit-ledger.service.ts for state-validated, ledger-backed operations.
 * CRITICAL: Deposit approval must be idempotent — double-approve must not double-credit.
 */

import { db } from '@/lib/db';
import { depositRepository } from './deposit.repository';
import { depositLedgerService } from './deposit-ledger.service';
import { logger } from '@/lib/logger';
import { paiseToRupees } from '@/lib/flatten-rider';
import type { DepositReview } from './deposit.types';

export const depositUseCases = {
  async getDepositStatus(riderDbId: string) {
    return depositRepository.findByRiderId(riderDbId);
  },

  async submitDeposit(riderDbId: string, amount: number, proofUrl: string) {
    const MIN_DEPOSIT_PAISE = 50000;
    if (amount < MIN_DEPOSIT_PAISE) {
      throw new Error(`Minimum deposit amount is ₹${MIN_DEPOSIT_PAISE / 100}`);
    }
    return depositRepository.submitDeposit(riderDbId, amount, proofUrl);
  },

  async reviewDeposit(riderDbId: string, reviewerId: string, review: DepositReview) {
    switch (review.action) {
      case 'APPROVE': {
        await depositLedgerService.approve({
          riderId: riderDbId,
          adminId: reviewerId,
        });
        await db.rider.updateMany({
          where: {
            id: riderDbId,
            lifecycleStatus: { in: ['DEPOSIT_PENDING', 'GUARANTOR_APPROVED'] },
          },
          data: { lifecycleStatus: 'DEPOSIT_APPROVED', depositDoneAt: new Date() },
        });
        break;
      }
      case 'REJECT': {
        await depositLedgerService.reject({
          riderId: riderDbId,
          adminId: reviewerId,
          reason: review.rejectionReason || 'No reason provided',
        });
        break;
      }
    }

    return depositRepository.findByRiderId(riderDbId);
  },

  async requestRefund(riderDbId: string, adminId: string, refundAmountInPaise?: number) {
    const deposit = await depositRepository.findByRiderId(riderDbId);
    if (!deposit) throw new Error('No deposit record found');
    if (deposit.status !== 'APPROVED') {
      throw new Error(`Cannot refund deposit in status ${deposit.status}`);
    }

    await depositLedgerService.refund({
      riderId: riderDbId,
      adminId,
      refundAmountInPaise: refundAmountInPaise || deposit.amountInPaise,
    });

    logger.info('[DepositUseCases] Refund processed', {
      riderId: riderDbId,
      refundAmountInPaise: refundAmountInPaise || deposit.amountInPaise,
    });

    return depositRepository.findByRiderId(riderDbId);
  },

  async forfeitDeposit(riderDbId: string, adminId: string, reason: string) {
    const deposit = await depositRepository.findByRiderId(riderDbId);
    if (!deposit) throw new Error('No deposit record found');
    if (deposit.status !== 'APPROVED') {
      throw new Error(`Cannot forfeit deposit in status ${deposit.status}`);
    }

    await depositLedgerService.forfeit({ riderId: riderDbId, adminId, reason });

    logger.info('[DepositUseCases] Deposit forfeited', { riderId: riderDbId, reason });
    return depositRepository.findByRiderId(riderDbId);
  },

  async listDeposits(filters: {
    status?: string;
    riderId?: string;
    startDate?: string;
    endDate?: string;
    page: number;
    limit: number;
  }) {
    const { status, riderId, startDate, endDate, page, limit } = filters;

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (riderId) where.riderId = riderId;
    if (startDate || endDate) {
      (where as any).createdAt = {};
      if (startDate) (where as any).createdAt.gte = new Date(startDate);
      if (endDate) (where as any).createdAt.lte = new Date(`${endDate}T23:59:59.999Z`);
    }

    const [records, total] = await depositRepository.findAllPaginated({ where, page, limit });

    const formatted = (records as any[]).map((r) => ({
      ...r,
      amountInPaise: undefined,
      amount: paiseToRupees(r.amountInPaise),
      refundedAmount: r.refundedAmountInPaise ? paiseToRupees(r.refundedAmountInPaise) : null,
    }));

    return {
      records: formatted,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
};
