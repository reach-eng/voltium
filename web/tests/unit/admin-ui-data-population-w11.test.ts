import { describe, it, expect, vi, beforeEach } from 'vitest';
import { db } from '@/lib/db';
import { adminRepository } from '@/server/modules/admin/admin.repository';
import { getRevenueTrend, getDashboardStats } from '@/lib/services/dashboard';
import { recordJobRun } from '@/server/workers/jobs/record-job-run';
import { couponUseCases } from '@/server/modules/coupons/coupon.use-cases';
import { scoreUseCases } from '@/server/modules/scores/score.use-cases';
import { incidentUseCases } from '@/server/modules/incidents/incident.use-cases';

vi.mock('@/lib/db', () => ({
  db: {
    rider: { count: vi.fn(), findMany: vi.fn() },
    vehicle: { count: vi.fn(), findMany: vi.fn() },
    wallet: { aggregate: vi.fn() },
    transaction: { count: vi.fn(), aggregate: vi.fn() },
    supportTicket: { count: vi.fn(), findMany: vi.fn() },
    hub: { count: vi.fn(), findMany: vi.fn() },
    kycProfile: { count: vi.fn(), findMany: vi.fn() },
    guarantor: { count: vi.fn() },
    admin: { count: vi.fn() },
    rentalLease: { count: vi.fn() },
    auditLog: { findMany: vi.fn(), count: vi.fn(), create: vi.fn() },
    systemSetting: { upsert: vi.fn(), findUnique: vi.fn(), findMany: vi.fn() },
    coupon: { create: vi.fn(), update: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    riderScore: { findMany: vi.fn(), count: vi.fn() },
    incident: { findMany: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/lib/raw-query', () => ({
  rawQuery: vi.fn(),
}));

vi.mock('@/lib/audit-log', () => ({
  createAuditLog: vi.fn().mockResolvedValue({}),
}));

describe('Phase W11 — Admin UI Data Population (PR-P)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('W11a: Audit Logs & Repository Filtering (U-3)', () => {
    it('supports comma-separated entity list in getAuditLogs', async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([
        { id: '1', action: 'BACKUP_CREATED', entity: 'BackupJob', actorId: 'admin1', entityId: 'b1', details: null, createdAt: new Date() } as any,
      ]);
      vi.mocked(db.auditLog.count).mockResolvedValueOnce(1);

      const result = await adminRepository.getAuditLogs({
        entity: 'BackupJob, BackupSchedule',
        page: 1,
        limit: 10,
      });

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            entity: { in: ['BackupJob', 'BackupSchedule'] },
          }),
        })
      );
      expect(result.logs.length).toBe(1);
      expect(result.total).toBe(1);
    });

    it('supports actionPrefix, date range, and q search in getAuditLogs', async () => {
      vi.mocked(db.auditLog.findMany).mockResolvedValueOnce([]);
      vi.mocked(db.auditLog.count).mockResolvedValueOnce(0);

      await adminRepository.getAuditLogs({
        actionPrefix: 'backup.',
        from: '2026-08-01',
        to: '2026-08-25',
        q: 'system',
      });

      expect(db.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            action: { startsWith: 'backup.' },
            createdAt: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
            OR: expect.arrayContaining([
              expect.objectContaining({ action: { contains: 'system', mode: 'insensitive' } }),
            ]),
          }),
        })
      );
    });
  });

  describe('W11b: Dashboard Aggregations & Date Normalization (U-6, U-7)', () => {
    it('normalizes Date objects from SQL into YYYY-MM-DD keys for revenue trend', async () => {
      const { rawQuery } = await import('@/lib/raw-query');
      const testDate = new Date(Date.now() - 86400000 * 2); // 2 days ago
      vi.mocked(rawQuery).mockResolvedValueOnce([
        {
          date: testDate,
          revenue: BigInt(500000), // 500000 paise = 5000 rupees
          riderCount: BigInt(12),
        },
      ]);

      const trend = await getRevenueTrend(7);
      expect(trend.length).toBe(7);
      const matching = trend.find((t) => t.revenue === 5000);
      expect(matching).toBeDefined();
      expect(matching?.riders).toBe(12);
    });

    it('calculates totalRevenue in getDashboardStats from rent payments', async () => {
      vi.mocked(db.rider.count).mockResolvedValue(100);
      vi.mocked(db.vehicle.count).mockResolvedValue(50);
      vi.mocked(db.wallet.aggregate).mockResolvedValue({ _sum: { balanceInPaise: 100000, securityDepositInPaise: 200000 } } as any);
      vi.mocked(db.transaction.count).mockResolvedValue(5);
      vi.mocked(db.transaction.aggregate).mockResolvedValue({ _sum: { amountInPaise: 15000000 } } as any); // ?150,000
      vi.mocked(db.supportTicket.count).mockResolvedValue(3);
      vi.mocked(db.hub.count).mockResolvedValue(4);
      vi.mocked(db.kycProfile.count).mockResolvedValue(2);
      vi.mocked(db.guarantor.count).mockResolvedValue(1);
      vi.mocked(db.admin.count).mockResolvedValue(6);
      vi.mocked(db.rentalLease.count).mockResolvedValue(40);

      const stats = await getDashboardStats();
      expect(stats.totalRevenue).toBe(150000);
      expect(stats.activeRentals).toBe(40);
    });

    it('recordJobRun records job run info into SystemSetting', async () => {
      vi.mocked(db.systemSetting.upsert).mockResolvedValueOnce({ key: 'job:last_run:test-job', value: '' } as any);

      await recordJobRun('test-job', 'SUCCESS', { itemsProcessed: 42 });

      expect(db.systemSetting.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { key: 'job:last_run:test-job' },
          create: expect.objectContaining({
            key: 'job:last_run:test-job',
            value: expect.stringContaining('SUCCESS'),
          }),
        })
      );
    });
  });

  describe('W11b: Scores Risk Counts & Hub Filtering (U-11, U-12)', () => {
    it('aggregates server-side risk counts and filters by hubId', async () => {
      vi.mocked(db.riderScore.findMany).mockResolvedValueOnce([
        {
          id: 's1',
          riderId: 'r1',
          paymentScore: 80,
          kycScore: 90,
          activityScore: 85,
          supportScore: 70,
          compositeScore: 82,
          riskLevel: 'LOW',
          lastCalculated: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          rider: {
            fullName: 'Rider One',
            riderId: 'V-001',
            phone: '9876543210',
            lifecycleStatus: 'ACTIVE',
            pickupHub: 'hub-123',
          },
        } as any,
      ]);
      vi.mocked(db.riderScore.count)
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(10) // LOW
        .mockResolvedValueOnce(5) // MEDIUM
        .mockResolvedValueOnce(2) // HIGH
        .mockResolvedValueOnce(1); // CRITICAL

      const result = await scoreUseCases.list({ hubId: 'hub-123', page: 1, limit: 10 });

      expect(db.riderScore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            rider: expect.objectContaining({
              pickupHub: 'hub-123',
            }),
          }),
        })
      );
      expect(result.scores[0].pickupHub).toBe('hub-123');
      expect(result.riskCounts).toEqual({
        all: 18,
        LOW: 10,
        MEDIUM: 5,
        HIGH: 2,
        CRITICAL: 1,
      });
    });
  });

  describe('W11c: Coupons minAmount in Paise (U-16)', () => {
    it('multiplies minAmount by 100 on create', async () => {
      vi.mocked(db.coupon.create).mockImplementationOnce(async ({ data }: any) => ({
        id: 'c1',
        ...data,
      }));

      const coupon = await couponUseCases.create(
        {
          code: 'SAVE100',
          description: 'Save 100 on orders',
          discountType: 'FIXED',
          discountValue: 50,
          minAmount: 100, // ?100
          validFrom: '2026-08-01',
          validUntil: '2026-08-31',
          isActive: true,
        },
        'admin-1'
      );

      expect(db.coupon.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            discountValueInPaise: 5000,
            minAmount: 10000, // 100 * 100 paise
          }),
        })
      );
    });

    it('multiplies minAmount by 100 on update', async () => {
      vi.mocked(db.coupon.findUnique).mockResolvedValueOnce({ discountType: 'FIXED' } as any);
      vi.mocked(db.coupon.update).mockImplementationOnce(async ({ data }: any) => ({
        id: 'c1',
        ...data,
      }));

      await couponUseCases.update('c1', { minAmount: 250 }, 'admin-1');

      expect(db.coupon.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'c1' },
          data: expect.objectContaining({
            minAmount: 25000, // 250 * 100 paise
          }),
        })
      );
    });
  });

  describe('W11c: Incident hasInsurance & assignedAdmin Mapping (U-17)', () => {
    it('maps hasInsurance and assignedAdmin in incidentUseCases.list', async () => {
      vi.mocked(db.incident.findMany).mockResolvedValueOnce([
        {
          id: 'inc-1',
          incidentId: 'INC-1001',
          riderId: 'r1',
          vehicleId: 'v1',
          type: 'ACCIDENT',
          severity: 'HIGH',
          title: 'Minor collision',
          description: 'Rider scratched fender',
          location: 'Connaught Place',
          status: 'INVESTIGATING',
          assignedTo: 'admin-1',
          insuranceClaim: 'CLAIM-9988',
          createdAt: new Date(),
          updatedAt: new Date(),
          rider: { fullName: 'John Doe', riderId: 'R-1', phone: '9999999999' },
          vehicle: { vehicleNumber: 'DL01AB1234', model: 'Volt-1' },
          assignedAdmin: { name: 'Super Admin' },
        } as any,
      ]);
      vi.mocked(db.incident.count)
        .mockResolvedValueOnce(1) // total
        .mockResolvedValueOnce(0) // open
        .mockResolvedValueOnce(1) // investigating
        .mockResolvedValueOnce(0) // resolved
        .mockResolvedValueOnce(0); // closed

      const result = await incidentUseCases.list({ page: 1, limit: 10 });
      expect(result.incidents[0].hasInsurance).toBe(true);
      expect(result.incidents[0].assignedToName).toBe('Super Admin');
      expect(result.statusCounts).toEqual({
        all: 1,
        OPEN: 0,
        INVESTIGATING: 1,
        RESOLVED: 0,
        CLOSED: 0,
      });
    });
  });
});
