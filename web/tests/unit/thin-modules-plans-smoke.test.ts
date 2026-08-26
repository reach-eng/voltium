/**
 * PR-M (Ticket #22.1) — smoke tests for the plans module.
 *
 * Per docs/AUDIT_SMALL_SERVER_MODULES_2026-07-30.md finding 3.1, 12 modules
 * are single-use-cases files with no dedicated unit tests. This file
 * completes the coverage by adding tests for plans.
 *
 * Plans is more complex than other thin modules (uses cache + walletLedgerService),
 * so the smoke tests focus on:
 *   1. The pure `getDurationForPlanType` helper (most important — locked-in by BUSINESS LOGIC)
 *   2. The `list` use case (paginated, formats paise → rupees)
 *   3. The `create` use case (computes durationDays from type, invalidates cache, audit log)
 *   4. The `update` use case (prevents manual durationDays mutation, recomputes from type)
 *
 * `subscribeToPlan` and `listActivePlans` are not tested here — they require
 * complex cache + wallet setup. They're already exercised in integration tests.
 *
 * Run: npx vitest run tests/unit/thin-modules-plans-smoke.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockDb, mockAuditLog, mockInvalidateCache, mockGetOrSet, mockWalletDebit } = vi.hoisted(() => {
  const mockDb: any = {};
  const mockAuditLog = vi.fn(() => Promise.resolve());
  const mockInvalidateCache = vi.fn();
  const mockGetOrSet = vi.fn(async (key: string, fn: () => Promise<any>) => fn());
  const mockWalletDebit = vi.fn();
  return { mockDb, mockAuditLog, mockInvalidateCache, mockGetOrSet, mockWalletDebit };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mockAuditLog,
}));
vi.mock('@/lib/cache', () => ({
  getOrSetResponse: mockGetOrSet,
  invalidateCache: mockInvalidateCache,
}));
vi.mock('@/server/modules/wallet/wallet-ledger.service', () => ({
  walletLedgerService: { debit: mockWalletDebit },
}));
vi.mock('@/lib/flatten-rider', () => ({
  paiseToRupees: (p: number) => p / 100,
  rupeesToPaise: (r: number) => r * 100,
}));

import { getDurationForPlanType, planUseCases } from '@/server/modules/plans/plan.use-cases';

describe('plans (thin module) — getDurationForPlanType helper', () => {
  it('returns 1 day for DAILY plans', () => {
    expect(getDurationForPlanType('DAILY')).toBe(1);
  });

  it('returns 7 days for WEEKLY plans', () => {
    expect(getDurationForPlanType('WEEKLY')).toBe(7);
  });

  it('returns 30 days for MONTHLY plans', () => {
    expect(getDurationForPlanType('MONTHLY')).toBe(30);
  });

  it('returns 7 (default) for unknown types', () => {
    expect(getDurationForPlanType('UNKNOWN')).toBe(7);
  });

  it('uppercases input before matching', () => {
    expect(getDurationForPlanType('daily')).toBe(1);
    expect(getDurationForPlanType('Weekly')).toBe(7);
    expect(getDurationForPlanType('monthly')).toBe(30);
  });

  it('returns 7 (default) for empty string', () => {
    expect(getDurationForPlanType('')).toBe(7);
  });
});

describe('plans (thin module) — list() use case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.rentalPlan = {
      findMany: vi.fn().mockResolvedValue([
        { id: 'p1', name: 'Daily', price: 10000 },   // 100 rupees
        { id: 'p2', name: 'Weekly', price: 60000 },  // 600 rupees
      ]),
      count: vi.fn().mockResolvedValue(2),
    };
  });

  it('list() paginates and converts price from paise to rupees', async () => {
    const result = await planUseCases.list(1, 10);
    expect(result.plans).toEqual([
      { id: 'p1', name: 'Daily', price: 100 },
      { id: 'p2', name: 'Weekly', price: 600 },
    ]);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });
});

describe('plans (thin module) — create() use case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.rentalPlan = {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'p-new', ...data })),
    };
  });

  it('create() computes durationDays from type', async () => {
    await planUseCases.create(
      { name: 'Daily Plan', type: 'DAILY', price: 100 },
      'admin-1'
    );
    expect(mockDb.rentalPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Daily Plan',
          type: 'DAILY',
          durationDays: 1,
          price: 10000, // rupees to paise
          isActive: true,
        }),
      })
    );
  });

  it('create() invalidates both rental_plans and rider_plans caches', async () => {
    await planUseCases.create({ name: 'Test', type: 'WEEKLY', price: 500 }, 'admin-1');
    expect(mockInvalidateCache).toHaveBeenCalledWith('rental_plans*');
    expect(mockInvalidateCache).toHaveBeenCalledWith('rider_plans*');
  });

  it('create() fires audit log', async () => {
    await planUseCases.create({ name: 'Test', type: 'MONTHLY', price: 1500 }, 'admin-1');
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'plan.create', actorId: 'admin-1' })
    );
  });
});

describe('plans (thin module) — update() use case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.rentalPlan = {
      update: vi.fn().mockImplementation(({ where, data }) =>
        Promise.resolve({ id: where.id, ...data })
      ),
    };
  });

  it('update() prevents manual durationDays mutation', async () => {
    // Attempt to manually set durationDays = 999; should be ignored
    await planUseCases.update('p1', { durationDays: 999, name: 'Renamed' }, 'admin-1');
    expect(mockDb.rentalPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({ durationDays: 999 }),
      })
    );
  });

  it('update() recomputes durationDays from type', async () => {
    await planUseCases.update('p1', { type: 'MONTHLY' }, 'admin-1');
    expect(mockDb.rentalPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: 'MONTHLY', durationDays: 30 }),
      })
    );
  });

  it('update() converts price from rupees to paise', async () => {
    await planUseCases.update('p1', { price: 200 }, 'admin-1');
    expect(mockDb.rentalPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ price: 20000 }),
      })
    );
  });

  it('update() invalidates both rental_plans and rider_plans caches', async () => {
    await planUseCases.update('p1', { name: 'Renamed' }, 'admin-1');
    expect(mockInvalidateCache).toHaveBeenCalledWith('rental_plans*');
    expect(mockInvalidateCache).toHaveBeenCalledWith('rider_plans*');
  });
});

describe('plans (thin module) — delete() use case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.rentalPlan = { delete: vi.fn().mockResolvedValue({}) };
  });

  it('delete() removes the plan and invalidates caches', async () => {
    await planUseCases.delete('p1', 'admin-1');
    expect(mockDb.rentalPlan.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(mockInvalidateCache).toHaveBeenCalledWith('rental_plans*');
    expect(mockInvalidateCache).toHaveBeenCalledWith('rider_plans*');
  });
});
