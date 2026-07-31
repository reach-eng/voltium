import { db } from '@/lib/db';
import { fcmService } from '@/lib/fcm';
import { logger } from '@/lib/logger';
import { DepositStateError } from './deposit.errors';

export type DepositStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REFUNDED' | 'FORFEITED';
export type DepositTransition = 'APPROVE' | 'REJECT' | 'REFUND' | 'FORFEIT';

const VALID_TRANSITIONS: Record<DepositStatus, DepositTransition[]> = {
  PENDING: ['APPROVE', 'REJECT'],
  APPROVED: ['REFUND', 'FORFEIT'],
  REJECTED: [],
  REFUNDED: [],
  FORFEITED: [],
};

export async function _notifyDepositStatusChange(riderId: string, eventType: string): Promise<void> {
  try {
    const rider = await db.rider.findUnique({
      where: { id: riderId },
      select: { fcmToken: true },
    });
    if (rider?.fcmToken) {
      await fcmService.sendOverlayTrigger(rider.fcmToken, eventType);
    }
  } catch (error) {
    logger.warn('[DepositService] Failed to send FCM deposit notification', { riderId, eventType, error });
  }
}

export async function _getAndValidate(tx: any, riderId: string, action: DepositTransition) {
  const record = await tx.depositRecord.findUnique({ where: { riderId } });
  if (!record) {
    throw new DepositStateError(`No deposit record found for rider ${riderId}`);
  }

  const allowed = VALID_TRANSITIONS[record.status as DepositStatus] ?? [];
  if (!allowed.includes(action)) {
    throw new DepositStateError(
      `Cannot ${action} a deposit in status ${record.status}. Allowed actions: ${allowed.join(', ') || 'none'}`
    );
  }

  return record;
}

export async function _requireWallet(tx: any, riderId: string) {
  const wallet = await tx.wallet.findUnique({
    where: { riderId },
    select: { id: true, balanceInPaise: true, securityDepositInPaise: true },
  });
  if (!wallet) {
    throw new DepositStateError(`Wallet not found for rider ${riderId}`);
  }
  return wallet;
}
