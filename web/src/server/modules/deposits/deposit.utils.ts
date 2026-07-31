import { db } from '@/lib/db';

async function validateApproval(riderId: string) {
  const record = await db.depositRecord.findFirst({
    where: { riderId },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return { approved: false, reason: 'No deposit record found' };
  if (record.status === 'APPROVED') return { approved: false, reason: 'Deposit already approved' };
  if (record.status !== 'PENDING') return { approved: false };
  return { approved: true, record };
}

async function validateRejection(riderId: string) {
  const record = await db.depositRecord.findFirst({
    where: { riderId },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return { valid: false, reason: 'No deposit record found' };
  if (record.status !== 'PENDING') return { valid: false };
  return { valid: true, record };
}

function getRefundEligibleAmount(status: string, amountInPaise: number): number {
  if (status === 'APPROVED') return amountInPaise;
  return 0;
}

const DEPOSIT_ACTION_MAP: Record<string, string> = {
  'deposit.approve': 'APPROVE',
  'deposit.reject': 'REJECT',
  'deposit.refund': 'REFUND',
  'deposit.forfeit': 'DELETE',
  approve: 'APPROVE',
  reject: 'REJECT',
  refund: 'REFUND',
  forfeit: 'DELETE',
};

async function logAction(params: {
  riderId: string;
  adminId: string;
  action: string;
  details?: Record<string, unknown>;
}) {
  const auditAction = DEPOSIT_ACTION_MAP[params.action] ?? 'UPDATE';
  await db.auditLog.create({
    data: {
      actorId: params.adminId,
      actorType: 'ADMIN',
      action: auditAction as any,
      entity: 'deposit',
      entityId: params.riderId,
      details: params.details ? JSON.stringify(params.details) : null,
    },
  });
}

export const depositService = {
  validateApproval,
  validateRejection,
  getRefundEligibleAmount,
  logAction,
};
