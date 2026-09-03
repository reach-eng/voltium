import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockDb = vi.hoisted(() => ({
  transaction: {
    updateMany: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));

const { transactionRepository } = await import('@/server/modules/transactions/transaction.repository');
const { TransactionServiceError } = await import('@/server/modules/transactions/transaction.service');

describe('Wallet Approval — Concurrency & CAS Race Condition Protection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('claims PENDING -> APPROVED atomically on first approval', async () => {
    mockDb.transaction.updateMany.mockResolvedValue({ count: 1 });
    mockDb.transaction.findUniqueOrThrow.mockResolvedValue({
      id: 'txn-1',
      status: 'APPROVED',
      approvedBy: 'admin-1',
      amountInPaise: 50000,
    });

    const result = await transactionRepository.updateStatus(
      'txn-1',
      'PENDING' as any,
      'APPROVED' as any,
      'admin-1'
    );

    expect(mockDb.transaction.updateMany).toHaveBeenCalledWith({
      where: { id: 'txn-1', status: 'PENDING' },
      data: expect.objectContaining({
        status: 'APPROVED',
        approvedBy: 'admin-1',
      }),
    });
    expect(result.status).toBe('APPROVED');
  });

  it('throws CONFLICT error on concurrent second approval attempt', async () => {
    // When a second request arrives, status is no longer PENDING -> 0 rows updated
    mockDb.transaction.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      transactionRepository.updateStatus(
        'txn-1',
        'PENDING' as any,
        'APPROVED' as any,
        'admin-2'
      )
    ).rejects.toThrowError(TransactionServiceError);

    await expect(
      transactionRepository.updateStatus(
        'txn-1',
        'PENDING' as any,
        'APPROVED' as any,
        'admin-2'
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('rejects concurrent rejection if status has already transitioned', async () => {
    mockDb.transaction.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      transactionRepository.updateStatus(
        'txn-1',
        'PENDING' as any,
        'REJECTED' as any,
        'admin-2',
        'Reason'
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
});
