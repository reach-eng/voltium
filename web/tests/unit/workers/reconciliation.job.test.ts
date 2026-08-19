import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { reconciliationJob } from '../../../src/server/workers/jobs/reconciliation.job';
import { clock } from '../../../src/lib/clock';
import { formatDateDDMMYYYY } from '../../../src/lib/date-utils';
import { JobQueue } from '../../../src/lib/job-queue';
import { OutboxEventTypes, OutboxService } from '../../../src/server/workers/outbox';

describe('Reconciliation Job', () => {
  beforeAll(async () => {
  });

  afterAll(async () => {
  });

  beforeEach(async () => {
    await testDb.outboxEvent.deleteMany();
    await testDb.reconciliationReport.deleteMany();
    await testDb.walletLedger.deleteMany();
    await testDb.wallet.deleteMany();
    await testDb.rider.deleteMany();
    clock.reset();
  });

  it('should report all healthy when ledger matches balance', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({
      data: { id: riderId, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    });
    const wallet = await testDb.wallet.create({
      data: { riderId, balanceInPaise: 1000 },
    });
    await testDb.walletLedger.create({
      data: {
        walletId: wallet.id,
        riderId,
        entryType: 'CREDIT',
        amountInPaise: 1000,
        category: 'TOP_UP',
        transactionId: null,
        balanceAfter: 1000,
        idempotencyKey: `backfill:opening:${wallet.id}`,
      }
    });

    const eventId = await OutboxService.emit(OutboxEventTypes.WALLET_RECONCILIATION, {});
    let result: any;
    await JobQueue.processJobs(OutboxEventTypes.WALLET_RECONCILIATION, async (job) => {
      result = await reconciliationJob.process(job);
    });

    const event = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
    expect(event?.status).toBe('COMPLETED');

    expect(result.totalWallets).toBeGreaterThanOrEqual(1);
    expect(result.matched).toBeGreaterThanOrEqual(1);
    expect(result.drift).toBe(0);
    expect(result.healthy).toBe(true);

    const report = await testDb.reconciliationReport.findFirst();
    expect(report).toBeDefined();
    expect(report?.totalWallets).toBe(1);
  });

  it('should detect drift when ledger does not match balance', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({
      data: { id: riderId, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    });
    const wallet = await testDb.wallet.create({
      data: { riderId, balanceInPaise: 1500 },
    });
    await testDb.walletLedger.create({
      data: {
        walletId: wallet.id,
        riderId,
        entryType: 'CREDIT',
        amountInPaise: 1000,
        category: 'TOP_UP',
        transactionId: null,
        balanceAfter: 1000,
        idempotencyKey: `backfill:opening:${wallet.id}`,
      }
    });

    const eventId = await OutboxService.emit(OutboxEventTypes.WALLET_RECONCILIATION, {});
    let result: any;
    await JobQueue.processJobs(OutboxEventTypes.WALLET_RECONCILIATION, async (job) => {
      result = await reconciliationJob.process(job);
    });

    const event = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
    expect(event?.status).toBe('COMPLETED');

    expect(result.totalWallets).toBeGreaterThanOrEqual(1);
    expect(result.mismatched).toBeGreaterThanOrEqual(1);
    expect(result.drift).toBe(500); // 1500 - 1000
    expect(result.healthy).toBe(false);

    // Verify outbox event was emitted for alert
    const outbox = await testDb.outboxEvent.findFirst({
      where: { eventType: 'admin.action' }
    });
    expect(outbox).toBeDefined();
    const payload = outbox?.payload ? JSON.parse(outbox.payload as string) : {};
    expect(payload.action).toBe('reconciliation.mismatch_alert');

    // TG-11 (P0-5): the legacy job now delegates to the single-SQL
    // wallet-reconciliation job, so the persisted report's mismatchDetails
    // must be fed from the unified driftedRiders result — not a legacy
    // per-wallet loop.
    const report = await testDb.reconciliationReport.findFirst();
    expect(report).toBeDefined();
    const details = report?.mismatchDetails ? JSON.parse(report.mismatchDetails) : [];
    expect(details.length).toBeGreaterThanOrEqual(1);
    expect(details[0]).toMatchObject({ riderId, drift: 500 });
  });

  it('is idempotent — returns existing report for today', async () => {
    // P0-5: the report row is keyed by the canonical DD-MM-YYYY date (the
    // SAME format the cron pre-check uses) — an ISO-seeded row would be a
    // different key and the pre-check would never match.
    const todayStr = formatDateDDMMYYYY(clock.now());
    await testDb.reconciliationReport.create({
      data: {
        reportDate: todayStr,
        totalWallets: 5,
        matched: 5,
        mismatched: 0,
        totalLedgerSum: 5000,
        totalWalletSum: 5000,
        drift: 0,
        mismatchDetails: '[]',
      }
    });

    // Even with a drifting wallet, it should return cached today's report
    const riderId = uuidv4();
    await testDb.rider.create({
      data: { id: riderId, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    });
    await testDb.wallet.create({ data: { riderId, balanceInPaise: 100 } });

    const eventId = await OutboxService.emit(OutboxEventTypes.WALLET_RECONCILIATION, {});
    let result: any;
    await JobQueue.processJobs(OutboxEventTypes.WALLET_RECONCILIATION, async (job) => {
      result = await reconciliationJob.process(job);
    });

    const event = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
    expect(event?.status).toBe('COMPLETED');

    expect(result.totalWallets).toBe(5);
    expect(result.matched).toBe(5);
  });

  it('attributes an admin-triggered run to the triggering admin (P0-4 / TG-9)', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({
      data: { id: riderId, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    });
    const wallet = await testDb.wallet.create({ data: { riderId, balanceInPaise: 1000 } });
    await testDb.walletLedger.create({
      data: {
        walletId: wallet.id,
        riderId,
        entryType: 'CREDIT',
        amountInPaise: 1000,
        category: 'TOP_UP',
        transactionId: null,
        balanceAfter: 1000,
        idempotencyKey: `backfill:opening:${wallet.id}`,
      },
    });

    // The admin-jobs route emits this event type with `triggeredBy` in the
    // payload (POST /api/admin/jobs). The worker must attribute the run.
    const eventId = await OutboxService.emit(
      OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
      { jobId: 'wallet-reconciliation', triggeredBy: 'admin-42', triggeredAt: new Date().toISOString() }
    );
    await JobQueue.processJobs(
      OutboxEventTypes.ADMIN_JOB_WALLET_RECONCILIATION,
      async (job) => {
        await reconciliationJob.process(job);
      }
    );

    const event = await testDb.outboxEvent.findUnique({ where: { id: eventId } });
    expect(event?.status).toBe('COMPLETED');

    // The SOC2 audit trail must show the admin, not 'system'.
    const audit = await testDb.auditLog.findFirst({
      where: { action: 'reconciliation.run', entityId: 'all' },
      orderBy: { createdAt: 'desc' },
    });
    expect(audit).toBeDefined();
    expect(audit?.actorId).toBe('admin-42');
    expect(audit?.actorType).toBe('ADMIN');
  });

  it('writes the daily report row the cron pre-check depends on (P0-5)', async () => {
    const riderId = uuidv4();
    await testDb.rider.create({
      data: { id: riderId, riderId: uuidv4(), referralCode: uuidv4().slice(0, 8), phone: `+91${Math.floor(1000000000 + Math.random() * 9000000000)}` },
    });
    const wallet = await testDb.wallet.create({ data: { riderId, balanceInPaise: 0 } });
    await testDb.walletLedger.create({
      data: {
        walletId: wallet.id,
        riderId,
        entryType: 'CREDIT',
        amountInPaise: 0,
        category: 'TOP_UP',
        transactionId: null,
        balanceAfter: 0,
        idempotencyKey: `backfill:opening:${wallet.id}`,
      },
    });

    await OutboxService.emit(OutboxEventTypes.WALLET_RECONCILIATION, {});
    await JobQueue.processJobs(OutboxEventTypes.WALLET_RECONCILIATION, async (job) => {
      await reconciliationJob.process(job);
    });

    // The row must exist under the DD-MM-YYYY key that checkReconciliationToday
    // queries — proving the worker feeds the cron pre-check and reconHistory.
    const todayStr = formatDateDDMMYYYY(clock.now());
    const report = await testDb.reconciliationReport.findUnique({
      where: { reportDate: todayStr },
    });
    expect(report).toBeDefined();
    expect(report?.mismatchDetails).toBeDefined();
  });
});
