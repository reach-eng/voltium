import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { testDb } from '../../_setup/test-postgres';
import { reconciliationJob } from '../../../src/server/workers/jobs/reconciliation.job';
import { clock } from '../../../src/lib/clock';
import { JobQueue } from '../../../src/lib/job-queue';
import { OutboxEventTypes, OutboxService } from '../../../src/server/workers/outbox';

describe('Reconciliation Job', () => {
  beforeAll(async () => {
    process.env.DATABASE_OFFLINE = 'false';
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
    console.log('OUTBOX_PAYLOAD:', outbox?.payload);
    const payload = outbox?.payload ? JSON.parse(outbox.payload as string) : {};
    expect(payload.action).toBe('reconciliation.mismatch_alert');
  });

  it('is idempotent — returns existing report for today', async () => {
    const todayStr = clock.now().toISOString().split('T')[0];
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
});
