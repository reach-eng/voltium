import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/logger', () => ({ logger: mocks.logger }));

vi.mock('@/lib/db', () => ({
  db: {
    transaction: { findMany: mocks.findMany, count: mocks.count },
  },
}));

vi.mock('@/lib/sign-rider', () => ({
  signRiderUrls: vi.fn((data) => Promise.resolve(data)),
}));

import { transactionRepository } from '@/server/modules/transactions/transaction.repository';

describe('Transaction rider-name PII fallback (dashboard P0-1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
  });

  it('masks the raw phone when fullName falls back to phone', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'tx_1',
        amountInPaise: 50000,
        rider: { id: 'r_1', riderId: 'RDR001', fullName: null, phone: '9876543210' },
        breakdowns: [],
      },
    ]);

    const result = await transactionRepository.list({ page: 1, limit: 5 });
    const row = result.transactions[0] as {
      rider: { fullName: string; phone: string | null };
    };

    // Masked display fallback — never the raw 10-digit number.
    expect(row.rider.fullName).not.toContain('9876543210');
    expect(row.rider.fullName).toContain('3210');
    expect(row.rider.phone).not.toContain('9876543210');
  });

  it('keeps a real fullName untouched', async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: 'tx_2',
        amountInPaise: 10000,
        rider: { id: 'r_2', riderId: 'RDR002', fullName: 'Asha Verma', phone: '9123456780' },
        breakdowns: [],
      },
    ]);

    const result = await transactionRepository.list({ page: 1, limit: 5 });
    const row = result.transactions[0] as {
      rider: { fullName: string; phone: string | null };
    };

    expect(row.rider.fullName).toBe('Asha Verma');
    expect(row.rider.phone).not.toContain('9123456780');
  });
});
