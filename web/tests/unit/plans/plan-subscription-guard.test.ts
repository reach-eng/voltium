/**
 * F-11: Plan subscription in-transaction lifecycle status guard
 *
 * Verifies:
 * 1. Pre-active rider (e.g. KYC_APPROVED) CAS transitions to PLAN_SELECTED with where { id, lifecycleStatus }
 * 2. Active rider (ACTIVE) CAS keeps ACTIVE status and starts plan window immediately
 * 3. Concurrent state modification (updateMany count === 0) throws RIDER_LIFECYCLE_CONFLICT
 * 4. In-transaction status check detects concurrent invalidation (e.g. status became SUSPENDED or CLOSED)
 * 5. Pre-tx status rejection for CLOSED or SUSPENDED riders
 * 6. Fallback to tx.rider.update when updateMany is not provided on mock
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const mocks = vi.hoisted(() => {
  const db: any = {
    rider: {
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    rentalPlan: {
      findUnique: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  return {
    db,
    invalidateRiderCache: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({ db: mocks.db }));
vi.mock('@/lib/server-cache', () => ({
  invalidateRiderCache: mocks.invalidateRiderCache,
}));
vi.mock('@/lib/cache', () => ({
  invalidateCache: vi.fn(),
}));

import { planUseCases, ALLOWED_STATES_FOR_PLAN_SELECTION } from '@/server/modules/plans/plan.use-cases';

describe('planUseCases.subscribeToPlan — In-Transaction CAS Lifecycle Guard (F-11)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const weeklyPlan = {
    id: 'plan_weekly_1',
    name: 'Weekly Saver',
    type: 'WEEKLY',
    durationDays: 7,
    priceInPaise: 120000,
    securityDepositInPaise: 200000,
    isActive: true,
  };

  it('exports ALLOWED_STATES_FOR_PLAN_SELECTION excluding CLOSED and SUSPENDED', () => {
    expect(ALLOWED_STATES_FOR_PLAN_SELECTION).toContain('NEW');
    expect(ALLOWED_STATES_FOR_PLAN_SELECTION).toContain('KYC_APPROVED');
    expect(ALLOWED_STATES_FOR_PLAN_SELECTION).toContain('ACTIVE');
    expect(ALLOWED_STATES_FOR_PLAN_SELECTION).not.toContain('CLOSED');
    expect(ALLOWED_STATES_FOR_PLAN_SELECTION).not.toContain('SUSPENDED');
  });

  it('rejects immediately before transaction if initial rider status is SUSPENDED or CLOSED', async () => {
    mocks.db.rider.findUnique.mockResolvedValue({
      id: 'rider_suspended',
      lifecycleStatus: 'SUSPENDED',
      requiresHigherDeposit: false,
    });
    mocks.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

    await expect(
      planUseCases.subscribeToPlan('rider_suspended', 'plan_weekly_1')
    ).rejects.toThrow('INVALID_STATE_FOR_PLAN_SELECTION');

    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });

  it('applies CAS guard with updateMany matching currentLifecycleStatus for pre-active rider', async () => {
    mocks.db.rider.findUnique.mockResolvedValue({
      id: 'rider_1',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: false,
    });
    mocks.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

    let whereClause: any = null;
    let dataClause: any = null;

    mocks.db.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        rider: {
          findUnique: vi.fn().mockResolvedValue({ lifecycleStatus: 'KYC_APPROVED' }),
          updateMany: vi.fn().mockImplementation(({ where, data }: any) => {
            whereClause = where;
            dataClause = data;
            return { count: 1 };
          }),
        },
      };
      return cb(tx);
    });

    const result = await planUseCases.subscribeToPlan('rider_1', 'plan_weekly_1');

    expect(whereClause).toEqual({
      id: 'rider_1',
      lifecycleStatus: 'KYC_APPROVED',
    });
    expect(dataClause.lifecycleStatus).toBe('PLAN_SELECTED');
    expect(dataClause.planStartDate).toBeNull();
    expect(dataClause.planEndDate).toBeNull();
    expect(result.startDate).toBeNull();
    expect(result.endDate).toBeNull();
    expect(mocks.invalidateRiderCache).toHaveBeenCalledWith('rider_1');
  });

  it('applies CAS guard with updateMany keeping ACTIVE status and setting plan window for active rider', async () => {
    mocks.db.rider.findUnique.mockResolvedValue({
      id: 'rider_active_1',
      lifecycleStatus: 'ACTIVE',
      requiresHigherDeposit: false,
    });
    mocks.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

    let whereClause: any = null;
    let dataClause: any = null;

    mocks.db.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        rider: {
          findUnique: vi.fn().mockResolvedValue({ lifecycleStatus: 'ACTIVE' }),
          updateMany: vi.fn().mockImplementation(({ where, data }: any) => {
            whereClause = where;
            dataClause = data;
            return { count: 1 };
          }),
        },
      };
      return cb(tx);
    });

    const result = await planUseCases.subscribeToPlan('rider_active_1', 'plan_weekly_1');

    expect(whereClause).toEqual({
      id: 'rider_active_1',
      lifecycleStatus: 'ACTIVE',
    });
    expect(dataClause.lifecycleStatus).toBe('ACTIVE');
    expect(dataClause.planStartDate).toBeInstanceOf(Date);
    expect(dataClause.planEndDate).toBeInstanceOf(Date);
    expect(result.startDate).not.toBeNull();
    expect(result.endDate).not.toBeNull();
    expect(result.durationDays).toBe(7);
  });

  it('detects concurrent race condition when updateMany returns count === 0 and throws RIDER_LIFECYCLE_CONFLICT', async () => {
    mocks.db.rider.findUnique.mockResolvedValue({
      id: 'rider_race',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: false,
    });
    mocks.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

    mocks.db.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        rider: {
          findUnique: vi.fn().mockResolvedValue({ lifecycleStatus: 'KYC_APPROVED' }),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      };
      return cb(tx);
    });

    await expect(
      planUseCases.subscribeToPlan('rider_race', 'plan_weekly_1')
    ).rejects.toThrow('RIDER_LIFECYCLE_CONFLICT');
  });

  it('rejects inside transaction if rider status changed concurrently to SUSPENDED', async () => {
    mocks.db.rider.findUnique.mockResolvedValue({
      id: 'rider_stale',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: false,
    });
    mocks.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

    mocks.db.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        rider: {
          // Inside transaction, fresh re-read surfaces that an admin just suspended the rider
          findUnique: vi.fn().mockResolvedValue({ lifecycleStatus: 'SUSPENDED' }),
          updateMany: vi.fn(),
        },
      };
      return cb(tx);
    });

    await expect(
      planUseCases.subscribeToPlan('rider_stale', 'plan_weekly_1')
    ).rejects.toThrow('INVALID_STATE_FOR_PLAN_SELECTION');
  });

  it('throws Rider not found if fresh in-transaction query returns null', async () => {
    mocks.db.rider.findUnique.mockResolvedValue({
      id: 'rider_deleted',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: false,
    });
    mocks.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

    mocks.db.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        rider: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      };
      return cb(tx);
    });

    await expect(
      planUseCases.subscribeToPlan('rider_deleted', 'plan_weekly_1')
    ).rejects.toThrow('Rider not found');
  });

  it('gracefully falls back to tx.rider.update when updateMany is not implemented on mock tx', async () => {
    mocks.db.rider.findUnique.mockResolvedValue({
      id: 'rider_fallback',
      lifecycleStatus: 'KYC_APPROVED',
      requiresHigherDeposit: false,
    });
    mocks.db.rentalPlan.findUnique.mockResolvedValue(weeklyPlan);

    let updatedData: any = null;
    mocks.db.$transaction.mockImplementation(async (cb: any) => {
      const tx = {
        rider: {
          update: vi.fn().mockImplementation(({ data }: any) => {
            updatedData = data;
            return {};
          }),
        },
      };
      return cb(tx);
    });

    const result = await planUseCases.subscribeToPlan('rider_fallback', 'plan_weekly_1');
    expect(updatedData.lifecycleStatus).toBe('PLAN_SELECTED');
    expect(result.planId).toBe('plan_weekly_1');
  });
});
