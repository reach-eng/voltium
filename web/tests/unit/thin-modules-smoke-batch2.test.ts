/**
 * PR-M (Ticket #22.1) — smoke tests batch 2 for thin single-use-cases modules.
 *
 * Per docs/AUDIT_SMALL_SERVER_MODULES_2026-07-30.md finding 3.1, 12 modules
 * are single-use-cases files with no dedicated unit tests.
 *
 * Batch 1 (thin-modules-smoke.test.ts) covered: legal, telemetry, offers, sync.
 * Batch 2 (this file) covers: announcements, coupons, monitoring.
 *
 * Remaining: plans, pricing, referrals, shifts (referrals already covered
 * by auth-referral-exists.test.ts).
 *
 * Run: npx vitest run tests/unit/thin-modules-smoke-batch2.test.ts
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockDb, mockAuditLog, mockSanitize } = vi.hoisted(() => {
  const mockDb: any = {};
  const mockAuditLog = vi.fn(() => Promise.resolve());
  const mockSanitize = vi.fn((s: string) => s);
  return { mockDb, mockAuditLog, mockSanitize };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/lib/audit-log', () => ({
  createAuditLog: mockAuditLog,
}));
vi.mock('@/lib/sanitize', () => ({
  sanitizeHtml: mockSanitize,
}));

// ---------------------------------------------------------------------------
// coupons
// ---------------------------------------------------------------------------
import { couponUseCases } from '@/server/modules/coupons/coupon.use-cases';

describe('coupons (thin module) — smoke tests (#22.1 batch 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.coupon = {
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
  });

  it('list() paginates correctly', async () => {
    const coupons = [{ id: 'c1', code: 'PROMO10' }];
    mockDb.coupon.findMany.mockResolvedValue(coupons);
    mockDb.coupon.count.mockResolvedValue(23);
    const result = await couponUseCases.list(1, 10);
    expect(result.coupons).toBe(coupons);
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 23, totalPages: 3 });
  });

  it('create() uppercases code and converts dates', async () => {
    mockDb.coupon.create.mockResolvedValue({ id: 'c1', code: 'PROMO10' });
    const result = await couponUseCases.create(
      {
        code: 'promo10',
        description: '10% off',
        discountType: 'PERCENTAGE',
        discountValue: 1000,
        validFrom: '2026-01-01',
        validUntil: '2026-12-31',
        isActive: true,
      },
      'admin-1'
    );
    expect(result.code).toBe('PROMO10');
    expect(mockDb.coupon.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'PROMO10',
          discountValueInPaise: 1000,
          validFrom: new Date('2026-01-01'),
          validUntil: new Date('2026-12-31'),
        }),
      })
    );
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'coupon.create' })
    );
  });

  it('update() uppercases code and converts dates', async () => {
    mockDb.coupon.update.mockResolvedValue({ id: 'c1' });
    await couponUseCases.update('c1', { code: 'newcode', validFrom: '2026-06-01' }, 'admin-1');
    expect(mockDb.coupon.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'NEWCODE',
          validFrom: new Date('2026-06-01'),
        }),
      })
    );
  });

  it('delete() removes and logs', async () => {
    mockDb.coupon.delete.mockResolvedValue({});
    await couponUseCases.delete('c1', 'admin-1');
    expect(mockDb.coupon.delete).toHaveBeenCalledWith({ where: { id: 'c1' } });
    await new Promise((r) => setTimeout(r, 0));
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'coupon.delete' })
    );
  });
});

// ---------------------------------------------------------------------------
// monitoring
// ---------------------------------------------------------------------------
import { monitoringUseCases } from '@/server/modules/monitoring/monitoring.use-cases';

describe('monitoring (thin module) — smoke tests (#22.1 batch 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub all the count/findFirst methods that getSystemMetrics() calls
    mockDb.rider = {
      count: vi.fn().mockResolvedValue(0),
    };
    mockDb.kycProfile = { count: vi.fn().mockResolvedValue(0) };
    mockDb.depositRecord = { count: vi.fn().mockResolvedValue(0) };
    mockDb.supportTicket = { count: vi.fn().mockResolvedValue(0) };
    mockDb.transaction = { count: vi.fn().mockResolvedValue(0) };
    mockDb.outboxEvent = { count: vi.fn().mockResolvedValue(0) };
    mockDb.deviceViolation = { count: vi.fn().mockResolvedValue(0) };
    mockDb.reconciliationReport = { findFirst: vi.fn().mockResolvedValue(null) };
  });

  it('getSystemMetrics() returns counts for all 10 dimensions', async () => {
    mockDb.rider.count
      .mockResolvedValueOnce(1500) // total
      .mockResolvedValueOnce(800);  // active
    mockDb.kycProfile.count.mockResolvedValueOnce(42);
    mockDb.depositRecord.count.mockResolvedValueOnce(7);
    mockDb.supportTicket.count.mockResolvedValueOnce(12);
    mockDb.transaction.count.mockResolvedValueOnce(95);
    mockDb.outboxEvent.count
      .mockResolvedValueOnce(3)   // failed
      .mockResolvedValueOnce(15); // pending
    mockDb.deviceViolation.count.mockResolvedValueOnce(2);
    mockDb.reconciliationReport.findFirst.mockResolvedValueOnce({
      reportDate: '2026-07-30',
      mismatched: 0,
    });

    const result = await monitoringUseCases.getSystemMetrics();
    expect(result).toEqual({
      totalRiders: 1500,
      activeRiders: 800,
      pendingKyc: 42,
      pendingDeposits: 7,
      openTickets: 12,
      recentTransactions: 95,
      failedOutbox: 3,
      pendingOutbox: 15,
      activeViolations: 2,
      latestReconciliation: { reportDate: '2026-07-30', mismatched: 0 },
    });
  });

  it('getSystemMetrics() returns zeros when DB is empty', async () => {
    const result = await monitoringUseCases.getSystemMetrics();
    expect(result.totalRiders).toBe(0);
    expect(result.activeRiders).toBe(0);
    expect(result.failedOutbox).toBe(0);
    expect(result.latestReconciliation).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// announcements
// ---------------------------------------------------------------------------
import { announcementUseCases } from '@/server/modules/announcements/announcement.use-cases';

describe('announcements (thin module) — smoke tests (#22.1 batch 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-set the mocks because clearAllMocks() also clears the implementations
    mockDb.announcement = {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({ id: 'a1' }),
    };
    mockDb.announcementDelivery = { createMany: vi.fn().mockResolvedValue({ count: 0 }) };
    mockDb.notification = { createMany: vi.fn().mockResolvedValue({ count: 0 }) };
    mockDb.rider = { findMany: vi.fn().mockResolvedValue([]) };
    mockDb.$transaction = vi.fn(async (fn: any) => fn(mockDb));
  });

  it('list() paginates and formats deliveries', async () => {
    mockDb.announcement.findMany.mockResolvedValue([
      {
        id: 'a1',
        title: 'Promo',
        message: 'Big sale',
        channel: 'PUSH',
        targetAudience: 'ALL',
        targetIds: [],
        scheduledAt: null,
        sentAt: new Date(),
        status: 'SENT',
        totalRecipients: 100,
        deliveries: [
          { status: 'DELIVERED' },
          { status: 'DELIVERED' },
          { status: 'READ' },
          { status: 'FAILED' },
        ],
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockDb.announcement.count.mockResolvedValue(1);

    // The actual signature is list(params: { page, limit })
    const result = await announcementUseCases.list({ page: 1, limit: 10 });
    expect(result.announcements).toHaveLength(1);
    expect(result.announcements[0]).toEqual(
      expect.objectContaining({
        deliveredCount: 2,
        readCount: 1,
        failedCount: 1,
      })
    );
    expect(result.pagination).toEqual({ page: 1, limit: 10, total: 1, totalPages: 1 });
  });

  it('list() defaults null targetIds to []', async () => {
    mockDb.announcement.findMany.mockResolvedValue([
      {
        id: 'a1',
        title: 'Promo',
        message: 'Big sale',
        channel: 'PUSH',
        targetAudience: 'ALL',
        targetIds: null,
        scheduledAt: null,
        sentAt: new Date(),
        status: 'SENT',
        totalRecipients: 0,
        deliveries: [],
        createdBy: 'admin-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockDb.announcement.count.mockResolvedValue(1);
    const result = await announcementUseCases.list({ page: 1, limit: 10 });
    expect(result.announcements[0].targetIds).toEqual([]);
  });

  it('create() with targetAudience=ALL finds all riders', async () => {
    mockDb.rider.findMany.mockResolvedValue([{ id: 'r1' }, { id: 'r2' }]);
    mockDb.announcement.create.mockResolvedValue({ id: 'a1' });

    await announcementUseCases.create(
      {
        title: 'Promo',
        message: 'Big sale',
        channel: 'PUSH',
        targetAudience: 'ALL',
        targetIds: [],
      },
      'admin-1'
    );

    // The implementation calls findMany with select id only, no where
    expect(mockDb.rider.findMany).toHaveBeenCalledWith({ select: { id: true } });
    expect(mockDb.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: 'Promo',
          message: 'Big sale',
          status: 'SENT',
          totalRecipients: 2,
        }),
      })
    );
  });

  it('create() with scheduledAt sets status=SCHEDULED', async () => {
    mockDb.announcement.create.mockResolvedValue({ id: 'a1' });
    await announcementUseCases.create(
      {
        title: 'Future',
        message: 'Coming soon',
        channel: 'IN_APP',
        targetAudience: 'ALL',
        targetIds: [],
        scheduledAt: '2027-01-01',
      },
      'admin-1'
    );
    expect(mockDb.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'SCHEDULED',
          scheduledAt: new Date('2027-01-01'),
          sentAt: null,
        }),
      })
    );
  });
});
