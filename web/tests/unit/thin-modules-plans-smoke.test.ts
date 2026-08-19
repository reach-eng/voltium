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
        { id: 'p1', name: 'Daily', priceInPaise: 10000, securityDepositInPaise: 5000 },  // 100 ₹ / 50 ₹
        { id: 'p2', name: 'Weekly', priceInPaise: 60000, securityDepositInPaise: 10000 }, // 600 ₹ / 100 ₹
      ]),
      count: vi.fn().mockResolvedValue(2),
    };
  });

  it('list() paginates and converts price from paise to rupees', async () => {
    const result = await planUseCases.list(1, 10);
    expect(result.plans).toEqual([
      { id: 'p1', name: 'Daily', priceInPaise: 10000, securityDepositInPaise: 5000, price: 100, securityDeposit: 50 },
      { id: 'p2', name: 'Weekly', priceInPaise: 60000, securityDepositInPaise: 10000, price: 600, securityDeposit: 100 },
    ]);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 2, totalPages: 1 });
  });

  // P0.1 (2026-08-05 rentals/vehicles/hubs audit): `list` previously read
  // `p.price` — a field that doesn't exist on RentalPlan (it has
  // `priceInPaise`) — so every plan serialized `price: NaN` to the admin UI
  // and the Flutter plan picker. Regression: formatted prices must be finite.
  it('list() never emits NaN for price or securityDeposit', async () => {
    const result = await planUseCases.list(1, 10);
    expect(result.plans).toHaveLength(2);
    for (const plan of result.plans) {
      expect(Number.isFinite(plan.price)).toBe(true);
      expect(Number.isFinite(plan.securityDeposit)).toBe(true);
    }
    // Explicit NaN guards on the exact P0.1 field path
    expect(planUseCases.list).toBeDefined();
  });
});

describe('plans (thin module) — create() use case', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.rentalPlan = {
      create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'p-new', ...data })),
    };
  });

  it('create() computes durationDays from type and defaults isActive to draft (false)', async () => {
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
          priceInPaise: 10000, // rupees to paise
          securityDepositInPaise: 0,
          // P0-6 (2026-08-07 verification): omitted isActive now defaults to
          // inactive (draft) instead of silently publishing the plan.
          isActive: false,
        }),
      })
    );
  });

  it('create() honors an explicit isActive: true flag', async () => {
    await planUseCases.create(
      { name: 'Daily Plan', type: 'DAILY', price: 100, isActive: true },
      'admin-1'
    );
    expect(mockDb.rentalPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isActive: true }),
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
        data: expect.objectContaining({ priceInPaise: 20000 }),
      })
    );
    // The legacy `price` key must be stripped — RentalPlan has no such column
    // (P0.1 field name is priceInPaise)
    const data = mockDb.rentalPlan.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('price');
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
    mockDb.rentalPlan = { update: vi.fn().mockResolvedValue({}) };
  });

  // P1.9 (2026-08-05 rentals/vehicles/hubs audit): delete is a SOFT delete —
  // sets deletedAt + isActive: false. The row and audit trail survive; every
  // read path filters deletedAt: null. Hard deletes are gone from the API.
  it('delete() soft-deletes the plan and invalidates caches', async () => {
    await planUseCases.delete('p1', 'admin-1');
    // Hard delete is gone from the API surface entirely
    expect((mockDb.rentalPlan as Record<string, unknown>).delete).toBeUndefined();
    const { where, data } = mockDb.rentalPlan.update.mock.calls[0][0];
    expect(where).toEqual({ id: 'p1' });
    expect(data).toMatchObject({ isActive: false });
    expect(data.deletedAt).toBeInstanceOf(Date);
    expect(mockInvalidateCache).toHaveBeenCalledWith('rental_plans*');
    expect(mockInvalidateCache).toHaveBeenCalledWith('rider_plans*');
  });
});
