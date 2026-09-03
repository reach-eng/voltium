import { describe, it, expect, vi, beforeEach } from 'vitest';
import { walletUseCases } from '@/server/modules/wallet/wallet.use-cases';
import { walletRepository } from '@/server/modules/wallet/wallet.repository';
import { db } from '@/lib/db';
import { TransactionStatus } from '@prisma/client';

vi.mock('@/lib/db', () => ({
  db: {
    rider: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb({
      transaction: {
        update: vi.fn(),
      },
      wallet: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    })),
  },
}));

vi.mock('@/server/modules/wallet/wallet.repository', () => ({
  walletRepository: {
    findTransactionByKey: vi.fn(),
    createTransaction: vi.fn(),
    findByRiderId: vi.fn(),
  },
}));

vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: vi.fn(),
}));

vi.mock('@/lib/notification-service', () => ({
  notificationService: {
    sendPushNotification: vi.fn(),
  },
}));

vi.mock('@/server/workers/outbox', () => ({
  OutboxService: {
    emit: vi.fn(),
  },
  OutboxEventTypes: {
    WALLET_TOPUP_REJECTED: 'WALLET_TOPUP_REJECTED',
  },
}));

describe('F-01: INSTANT top-up security', () => {
  const autoApproveSpy = vi.spyOn(walletUseCases, '_autoApproveTestTopup').mockResolvedValue(undefined as any);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does NOT auto-approve INSTANT payments with gatewayStatus=SUCCESS for regular riders', async () => {
    const regularRider = {
      id: 'rider-reg-1',
      phone: '9123456789',
      lifecycleStatus: 'ACTIVE',
    };

    vi.mocked(db.rider.findUnique).mockResolvedValue(regularRider as any);
    vi.mocked(walletRepository.findTransactionByKey).mockResolvedValue(null);

    let createdStatus: TransactionStatus | undefined;
    vi.mocked(walletRepository.createTransaction).mockImplementation(async (args: any) => {
      createdStatus = args.status;
      return { id: 'txn-1', ...args } as any;
    });

    const result = await walletUseCases.requestTopup(
      'rider-reg-1',
      50000,
      'TOP_UP',
      'INSTANT',
      {
        gatewayStatus: 'SUCCESS',
        idempotencyKey: 'test-key-instant-success',
      }
    );

    // Must be PENDING, never APPROVED
    expect(createdStatus).toBe(TransactionStatus.PENDING);
    expect(result.status).toBe(TransactionStatus.PENDING);
    // _autoApproveTestTopup must not be called
    expect(autoApproveSpy).not.toHaveBeenCalled();
  });

  it('does NOT auto-approve INSTANT payments with gatewayStatus=undefined for regular riders', async () => {
    const regularRider = {
      id: 'rider-reg-2',
      phone: '9123456789',
      lifecycleStatus: 'ACTIVE',
    };

    vi.mocked(db.rider.findUnique).mockResolvedValue(regularRider as any);
    vi.mocked(walletRepository.findTransactionByKey).mockResolvedValue(null);

    let createdStatus: TransactionStatus | undefined;
    vi.mocked(walletRepository.createTransaction).mockImplementation(async (args: any) => {
      createdStatus = args.status;
      return { id: 'txn-2', ...args } as any;
    });

    const result = await walletUseCases.requestTopup(
      'rider-reg-2',
      50000,
      'TOP_UP',
      'INSTANT',
      {
        idempotencyKey: 'test-key-instant-undef',
      }
    );

    expect(createdStatus).toBe(TransactionStatus.PENDING);
    expect(result.status).toBe(TransactionStatus.PENDING);
    expect(autoApproveSpy).not.toHaveBeenCalled();
  });
});
