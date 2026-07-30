/**
 * PR-M (Ticket #22.1) — smoke tests batch 3 for thin single-use-cases modules.
 *
 * Per docs/AUDIT_SMALL_SERVER_MODULES_2026-07-30.md finding 3.1, 12 modules
 * are single-use-cases files with no dedicated unit tests.
 *
 * Batch 1: legal, telemetry, offers, sync
 * Batch 2: coupons, monitoring, announcements
 * Batch 3 (this file): pricing, shifts
 *
 * Referrals is already covered by auth-referral-exists.test.ts.
 * Plans is more complex (uses cache + walletLedgerService) — gets its own
 * dedicated test file in a follow-up PR.
 *
 * Run: npx vitest run tests/unit/thin-modules-smoke-batch3.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockDb, mockAuditLog } = vi.hoisted(() => {
  const mockDb: any = {};
  const mockAuditLog = vi.fn(() => Promise.resolve());
  return { mockDb, mockAuditLog };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mockAuditLog,
}));

// ---------------------------------------------------------------------------
// pricing
// ---------------------------------------------------------------------------
import { pricingUseCases } from '@/server/modules/pricing/pricing.use-cases';

describe('pricing (thin module) — smoke tests (#22.1 batch 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.vehicle = { count: vi.fn() };
    mockDb.hub = { findUnique: vi.fn() };
  });

  it('calculate() returns base price when utilization is 0', async () => {
    mockDb.vehicle.count
      .mockResolvedValueOnce(10)  // total
      .mockResolvedValueOnce(10); // available
    const result = await pricingUseCases.calculate('hub-1', 100);
    expect(result).toEqual({
      basePrice: 100,
      dynamicPrice: 100,
      utilization: 0,
      surgeMultiplier: 1.0,
      totalVehicles: 10,
      availableVehicles: 10,
    });
  });

  it('calculate() applies 1.1x surge at >60% utilization', async () => {
    mockDb.vehicle.count
      .mockResolvedValueOnce(10)  // total
      .mockResolvedValueOnce(3);  // available (70% util)
    const result = await pricingUseCases.calculate('hub-1', 100);
    expect(result.surgeMultiplier).toBe(1.1);
    expect(result.dynamicPrice).toBe(110);
    expect(result.utilization).toBeCloseTo(0.7);
  });

  it('calculate() applies 1.2x surge at >80% utilization', async () => {
    mockDb.vehicle.count
      .mockResolvedValueOnce(10)  // total
      .mockResolvedValueOnce(1);  // available (90% util)
    const result = await pricingUseCases.calculate('hub-1', 100);
    expect(result.surgeMultiplier).toBe(1.2);
    expect(result.dynamicPrice).toBe(120);
  });

  it('calculate() handles hub with no vehicles', async () => {
    mockDb.vehicle.count
      .mockResolvedValueOnce(0)  // total
      .mockResolvedValueOnce(0); // available
    const result = await pricingUseCases.calculate('hub-1', 100);
    expect(result.utilization).toBe(0);
    expect(result.surgeMultiplier).toBe(1.0);
  });

  it('getHubPricing() throws NotFoundError for missing hub', async () => {
    mockDb.hub.findUnique.mockResolvedValue(null);
    await expect(pricingUseCases.getHubPricing('missing-hub')).rejects.toThrow(/Hub not found/);
  });

  it('getHubPricing() throws ValidationError for inactive hub', async () => {
    mockDb.hub.findUnique.mockResolvedValue({ id: 'hub-1', name: 'Test', isActive: false });
    await expect(pricingUseCases.getHubPricing('hub-1')).rejects.toThrow(/inactive/);
  });

  it('getHubPricing() returns active hub data', async () => {
    mockDb.hub.findUnique.mockResolvedValue({ id: 'hub-1', name: 'Test', isActive: true });
    mockDb.vehicle.count
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(15);
    const result = await pricingUseCases.getHubPricing('hub-1');
    expect(result).toEqual({
      hub: { id: 'hub-1', name: 'Test' },
      totalVehicles: 20,
      availableVehicles: 15,
    });
  });
});

// ---------------------------------------------------------------------------
// shifts
// ---------------------------------------------------------------------------
import { shiftUseCases } from '@/server/modules/shifts/shift.use-cases';

describe('shifts (thin module) — smoke tests (#22.1 batch 3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.shift = {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    // shifts may also call db.vehicle.findMany for available vehicles
    mockDb.vehicle = { findMany: vi.fn().mockResolvedValue([]) };
  });

  it('getShifts() returns shifts filtered by hub and date', async () => {
    mockDb.hub = {
      findUnique: vi.fn().mockResolvedValue({ id: 'hub-1', name: 'Test', isActive: true }),
    };
    mockDb.rentalLease = { groupBy: vi.fn().mockResolvedValue([]) };
    mockDb.shift.findMany.mockResolvedValue([
      { id: 's1', name: 'Morning', startTime: '09:00', endTime: '18:00', maxBookings: 10, parts: null },
    ]);
    const result = await shiftUseCases.getShifts('hub-1', '30-07-2026');
    expect(result.shifts).toHaveLength(1);
    expect(result.shifts[0].id).toBe('s1');
    expect(result.hub.id).toBe('hub-1');
  });

  it('getShifts() throws NotFoundError for missing hub', async () => {
    mockDb.hub = { findUnique: vi.fn().mockResolvedValue(null) };
    await expect(shiftUseCases.getShifts('missing-hub', '30-07-2026')).rejects.toThrow(/Hub not found/);
  });

  it('createShift() persists with parts JSON', async () => {
    mockDb.shift.create.mockResolvedValue({ id: 's1' });
    await shiftUseCases.createShift(
      {
        hubId: 'hub-1',
        startTime: '09:00',
        endTime: '18:00',
        parts: [
          { startTime: '09:00', endTime: '13:00' },
          { startTime: '14:00', endTime: '18:00' },
        ],
      },
      'admin-1'
    );
    expect(mockDb.shift.create).toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAuditLog).toHaveBeenCalled();
  });
});
