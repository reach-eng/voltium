/**
 * Deposits module - Repository.
 *
 * Data access for security deposit records and approval history.
 * All status transitions are validated against the deposit state machine.
 */

import { db } from '@/lib/db';
import { validateDepositTransition, DepositStateMachineError } from './deposit-state-machine';
import type { DepositStatus } from './deposit.types';

export const depositRepository = {
  async findByRiderId(riderDbId: string) {
    return db.depositRecord.findUnique({
      where: { riderId: riderDbId },
    });
  },

  async submitDeposit(riderDbId: string, amount: number, proofUrl: string) {
    const existing = await db.depositRecord.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: DepositStatus = (existing?.status as DepositStatus) || 'NOT_SUBMITTED';
    validateDepositTransition(currentStatus, 'PENDING_VERIFICATION');

    return db.depositRecord.upsert({
      where: { riderId: riderDbId },
      create: {
        riderId: riderDbId,
        amountInPaise: amount,
        status: 'PENDING_VERIFICATION',
        paidAt: new Date(),
      },
      update: {
        amountInPaise: amount,
        status: 'PENDING_VERIFICATION',
        paidAt: new Date(),
        // Reset rejection fields on resubmission
        rejectedAt: null,
        rejectedBy: null,
        rejectionReason: null,
      },
    });
  },

  async approveDeposit(riderDbId: string, reviewerId: string) {
    const existing = await db.depositRecord.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: DepositStatus = (existing?.status as DepositStatus) || 'NOT_SUBMITTED';
    validateDepositTransition(currentStatus, 'APPROVED');

    return db.depositRecord.update({
      where: { riderId: riderDbId },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedBy: reviewerId,
      },
    });
  },

  async findAllPaginated(params: { where: Record<string, unknown>; page: number; limit: number }) {
    const { where, page, limit } = params;
    return Promise.all([
      db.depositRecord.findMany({
        where,
        include: {
          rider: { select: { id: true, riderId: true, fullName: true, phone: true } },
          transaction: { select: { id: true, upiRef: true, proofUrl: true, method: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.depositRecord.count({ where }),
    ]);
  },

  async rejectDeposit(riderDbId: string, reviewerId: string, reason: string) {
    const existing = await db.depositRecord.findUnique({
      where: { riderId: riderDbId },
      select: { status: true },
    });

    const currentStatus: DepositStatus = (existing?.status as DepositStatus) || 'NOT_SUBMITTED';
    validateDepositTransition(currentStatus, 'REJECTED');

    return db.depositRecord.update({
      where: { riderId: riderDbId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedBy: reviewerId,
        rejectionReason: reason,
      },
    });
  },
};
