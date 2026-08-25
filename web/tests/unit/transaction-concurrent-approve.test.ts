import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireTransaction: vi.fn(),
  validateTransition: vi.fn(),
  logAction: vi.fn().mockResolvedValue(undefined),
  updateStatus: vi.fn(),
  credit: vi.fn().mockResolvedValue(undefined),
  creditSecurityDeposit: vi.fn().mockResolvedValue(undefined),
  findUniqueRider: vi.fn(),
  findUniqueDeposit: vi.fn(),
  updateRider: vi.fn().mockResolvedValue({}),
  invalidateRiderCache: vi.fn(),
  invalidateCache: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    $transaction: vi.fn((fn: any) => fn({})),
    rider: {
      findUnique: mocks.findUniqueRider,
      update: mocks.updateRider,
    },
    depositRecord: {
      findUnique: mocks.findUniqueDeposit,
    },
  },
}));

vi.mock('@/lib/cache', () => ({
  invalidateCache: mocks.invalidateCache,
}));

vi.mock('@/lib/sign-rider', () => ({
  invalidateRiderCache: mocks.invalidateRiderCache,
}));

vi.mock('@/server/modules/transactions/transaction.service', () => ({
  transactionService: {
    requireTransaction: mocks.requireTransaction,
    validateTransition: mocks.validateTransition,
    logAction: mocks.logAction,
  },
  TransactionServiceError: class TransactionServiceError extends Error {
    code: string;
    constructor(message: string, code = 'SERVICE_ERROR') {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock('@/server/modules/transactions/transaction.repository', () => ({
  transactionRepository: {
    updateStatus: mocks.updateStatus,
  },
}));

vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: {
    credit: mocks.credit,
    creditSecurityDeposit: mocks.creditSecurityDeposit,
  },
}));

import { transactionUseCases } from '@/server/modules/transactions/transaction.use-cases';
import { TransactionServiceError } from '@/server/modules/transactions/transaction.service';

describe('P0-2: Transaction Concurrent Approval CAS Gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects the second concurrent approver with CONFLICT before touching wallet', async () => {
    const txnData = {
      id: 'tx_123',
      status: 'PENDING',
      type: 'CREDIT',
      purpose: 'TOP_UP',
      amountInPaise: 50000,
      riderId: 'rider_1',
    };

    mocks.requireTransaction.mockResolvedValue(txnData);
    mocks.findUniqueRider.mockResolvedValue({ id: 'rider_1', lifecycleStatus: 'ACTIVE' });

    // Simulate CAS: first call succeeds, second call throws CONFLICT because status is no longer PENDING
    let firstCall = true;
    mocks.updateStatus.mockImplementation(async () => {
      if (firstCall) {
        firstCall = false;
        return { ...txnData, status: 'APPROVED', amountInPaise: 50000 };
      }
      throw new TransactionServiceError('Transaction was already processed by another admin', 'CONFLICT');
    });

    // Run first approval
    const result1 = await transactionUseCases.approveTransaction({
      transactionId: 'tx_123',
      action: 'APPROVE',
      adminId: 'admin_1',
    });
    expect(result1.status).toBe('APPROVED');
    expect(mocks.credit).toHaveBeenCalledTimes(1);

    // Run second concurrent approval
    await expect(
      transactionUseCases.approveTransaction({
        transactionId: 'tx_123',
        action: 'APPROVE',
        adminId: 'admin_2',
      })
    ).rejects.toThrow('Transaction was already processed by another admin');

    // Verify wallet was NOT credited a second time
    expect(mocks.credit).toHaveBeenCalledTimes(1);
  });
});
